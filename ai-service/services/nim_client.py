"""
nim_client.py - Wrapper untuk memanggil provider LLM.

PENTING (ARCHITECTURE.md bagian 7 & 8):
- API key WAJIB diambil dari environment variable, jangan hardcode.
- Ini adalah satu-satunya titik yang butuh koneksi internet aktif di seluruh sistem.
- Retry sederhana disediakan di sini, tapi kontrol rate-limit/queue utama tetap
  berada di backend-api (batch generate), sesuai prinsip "satu tempat kontrol".
"""

import os
import json
import logging
import time
import secrets
import requests

logger = logging.getLogger("ai-service.nim_client")

NON_MATERI_KEYWORDS = (
    "undang-undang",
    "undang undang",
    "uu no",
    "uu nomor",
    "pasal",
    "sanksi pelanggaran",
    "hak cipta",
    "copyright",
    "isbn",
    "penerbit",
    "editor",
    "penyunting",
    "desain sampul",
    "desain cover",
    "tata letak",
    "kata pengantar",
    "prakata",
    "daftar isi",
    "daftar pustaka",
    "tentang penulis",
    "biodata penulis",
    "riwayat hidup penulis",
    "nama buku",
    "judul buku",
)


class NIMAPIError(Exception):
    """Dilempar saat LLM provider gagal dipanggil (network error, rate limit, response invalid)."""
    pass


def _get_config():
    provider = os.getenv("AI_PROVIDER", "nvidia").strip().lower()
    if provider not in {"gemini", "nvidia"}:
        raise NIMAPIError("AI_PROVIDER harus 'gemini' atau 'nvidia'.")

    if provider == "nvidia":
        api_key = os.getenv("NIM_API_KEY")
        base_url = os.getenv("NIM_API_BASE_URL", "https://integrate.api.nvidia.com/v1")
        model = os.getenv("NIM_MODEL_NAME", "meta/llama-3.1-8b-instruct")
        timeout = int(os.getenv("NIM_REQUEST_TIMEOUT_SECONDS", "60"))
        max_retries = int(os.getenv("NIM_MAX_RETRIES", "4"))
        rate_limit_sleep = float(os.getenv("NIM_RATE_LIMIT_SLEEP_SECONDS", "30"))
        missing_key_name = "NIM_API_KEY"
    else:
        api_key = os.getenv("GEMINI_API_KEY")
        base_url = os.getenv("GEMINI_API_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")
        model = os.getenv("GEMINI_MODEL_NAME", "gemini-flash-latest")
        timeout = int(os.getenv("GEMINI_REQUEST_TIMEOUT_SECONDS", "60"))
        max_retries = int(os.getenv("GEMINI_MAX_RETRIES", "4"))
        rate_limit_sleep = float(os.getenv("GEMINI_RATE_LIMIT_SLEEP_SECONDS", "30"))
        missing_key_name = "GEMINI_API_KEY"

    if not api_key:
        raise NIMAPIError(
            f"{missing_key_name} tidak ditemukan di environment variable. "
            "Set di file .env (lihat .env.example), jangan hardcode di source code."
        )

    return {
        "provider": provider,
        "api_key": api_key,
        "base_url": base_url,
        "model": model,
        "timeout": timeout,
        "max_retries": max_retries,
        "rate_limit_sleep": rate_limit_sleep,
    }


def _build_prompt(materi_text: str, jenis_konten: str) -> str:
    """Menyusun prompt sesuai jenis konten yang diminta (flashcard/rangkuman/soal)."""

    source_guard = (
        "Gunakan HANYA konsep inti pembelajaran dari isi bab/materi. "
        "ABAIKAN dan JANGAN jadikan pertanyaan/rangkuman/soal dari metadata buku, "
        "sampul, judul buku, nama penulis, penerbit, ISBN, hak cipta, undang-undang, "
        "sanksi pelanggaran, kata pengantar, prakata, daftar isi, daftar pustaka, "
        "tentang penulis, biodata penulis, nomor halaman, header/footer, atau informasi administratif. "
        "Jika teks yang diberikan memuat bagian non-materi tersebut, anggap sebagai noise dan fokus pada "
        "fakta, definisi, proses, struktur, fungsi, contoh, dan hubungan konsep yang benar-benar diajarkan. "
    )

    instructions = {
        "flashcard": (
            source_guard +
            "Buatkan 8-12 flashcard (pertanyaan & jawaban singkat) dalam Bahasa Indonesia "
            "berdasarkan materi berikut. Jawab HANYA dengan JSON array, format: "
            '[{"pertanyaan": "...", "jawaban": "..."}]. '
            "WAJIB bungkus setiap key dan setiap value string JSON dengan tanda kutip ganda (\"). "
            "Jangan gunakan tanda kutip ganda di DALAM isi teks pertanyaan/jawaban -- "
            "kalau perlu mengutip sesuatu di dalam isi teks, gunakan tanda kutip tunggal ('). "
            "Jangan tambahkan teks lain di luar JSON."
        ),
        "rangkuman": (
            source_guard +
            "Buatkan rangkuman materi berikut dalam Bahasa Indonesia, bahasa sederhana "
            "sesuai kurikulum sekolah. Jawab HANYA dengan JSON array berisi blok konten "
            "terstruktur, TANPA teks lain di luar array. Tiap elemen array adalah satu "
            "object dengan salah satu bentuk berikut:\n"
            '  {"type": "paragraf", "teks": "..."}\n'
            '  {"type": "heading", "teks": "..."}\n'
            '  {"type": "list", "items": ["...", "..."]}\n'
            '  {"type": "contoh", "teks": "..."}\n'
            '  {"type": "tip", "teks": "..."}\n'
            "Susun urutan blok sebagai berikut:\n"
            "1. Satu atau dua blok 'paragraf' pembuka yang menjelaskan inti materi secara umum.\n"
            "2. Satu blok 'heading' berisi 'Poin-Poin Penting', lalu satu blok 'list' berisi "
            "4-6 poin penting.\n"
            "3. Satu blok 'heading' berisi 'Contoh', lalu 2-4 blok 'contoh' berisi penerapan "
            "konkret materi (boleh juga satu blok 'list' berisi 2-4 item, pilih salah satu).\n"
            "4. Satu blok 'paragraf' penutup singkat yang merangkum kenapa materi ini penting.\n"
            "Jangan pakai markdown bold/italic (*, **) di dalam teks manapun."
        ),
        "soal": (
            source_guard +
            "Buatkan 5-10 soal pilihan ganda (4 opsi: A/B/C/D) dalam Bahasa Indonesia berdasarkan "
            "materi berikut, untuk MENGUJI PEMAHAMAN siswa, bukan sekadar hafalan istilah. "
            "ATURAN PENTING supaya soal bervariasi dan tidak terasa berulang:\n"
            "1. JANGAN membuat semua soal dengan pola 'Apa yang dimaksud dengan <istilah>?' secara "
            "berturut-turut. Variasikan bentuk pertanyaan: definisi, contoh penerapan, membedakan "
            "dua konsep yang mirip, atau soal hitung/kasus singkat kalau materi memungkinkan.\n"
            "2. JANGAN jadikan opsi jawaban berisi istilah-istilah lain dari materi yang didaur "
            "ulang tanpa konteks (mis. soal tentang 'bilangan cacah' beropsi 'bilangan asli', "
            "'bilangan prima', dst tanpa penjelasan) -- opsi jawaban HARUS berupa deskripsi/"
            "penjelasan singkat yang relevan dengan pertanyaan, BUKAN daftar nama istilah polos.\n"
            "3. Jawaban yang benar TIDAK BOLEH sekadar mengulang kata dari pertanyaan (mis. "
            "pertanyaan 'Apa yang dimaksud dengan bilangan genap?' TIDAK BOLEH punya opsi jawaban "
            "'Bilangan genap' begitu saja) -- jawaban benar harus berupa penjelasan konsepnya, "
            "mis. 'Bilangan yang habis dibagi 2'.\n"
            "4. Ketiga opsi pengecoh (yang salah) harus masuk akal tapi jelas keliru kalau "
            "dipahami dengan benar, dan sebisa mungkin beda-beda strukturnya antar soal supaya "
            "siswa tidak melihat pengecoh yang sama berulang di banyak soal.\n"
            "5. SEBELUM menentukan jawaban_benar, kerjakan/hitung dulu jawabannya secara internal "
            "(terutama untuk soal hitung/angka) -- taruh langkah singkat itu di field \"alasan\", "
            "BARU tentukan opsi mana yang cocok dengan hasil hitungan tersebut. Jangan menebak "
            "jawaban_benar tanpa menghitung ulang lebih dulu, dan pastikan opsi yang ditandai benar "
            "memang sama persis nilainya dengan hasil di \"alasan\".\n"
            "Jawab HANYA dengan SATU JSON array TUNGGAL yang berisi SEMUA soal sebagai "
            "elemen-elemennya, format: "
            '[{"pertanyaan": "...", "opsi_jawaban": ["...","...","...","..."], "alasan": "...", "jawaban_benar": "A"}, '
            '{"pertanyaan": "...", "opsi_jawaban": ["...","...","...","..."], "alasan": "...", "jawaban_benar": "A"}]. '
            "opsi_jawaban WAJIB tepat 4 string (bukan diberi label 'A'/'B'/'C'/'D' di dalam teksnya, "
            "urutannya sendiri yang menentukan label A/B/C/D), dan jawaban_benar WAJIB salah satu "
            "dari 'A', 'B', 'C', 'D' sesuai urutan indeks opsi_jawaban yang benar. "
            "WAJIB bungkus setiap key dan setiap value string JSON dengan tanda kutip ganda (\"). "
            "Jangan gunakan tanda kutip ganda di DALAM isi teks pertanyaan/opsi/alasan -- "
            "kalau perlu mengutip sesuatu di dalam isi teks, gunakan tanda kutip tunggal ('). "
            "JANGAN membuat array JSON terpisah untuk tiap soal -- semua soal harus jadi elemen "
            "dari satu array yang sama, dipisahkan koma. Jangan tambahkan kalimat pembuka, "
            "penutup, atau teks lain di luar JSON."
        ),
    }

    instruction = instructions.get(jenis_konten)
    if not instruction:
        raise ValueError(f"jenis_konten tidak dikenal: {jenis_konten}")

    return f"{instruction}\n\nMateri:\n{materi_text}"


def _build_variant_prompt(source_content: dict, jenis_konten: str) -> str:
    variation_seed = secrets.token_hex(6)
    source_json = json.dumps(source_content, ensure_ascii=False)
    base = (
        "Buat versi alternatif yang BERBEDA dari konten berikut dalam Bahasa Indonesia. "
        "Jangan hanya parafrase ringan; ubah sudut pertanyaan, struktur kalimat, contoh, "
        "dan pilihan kata, tetapi makna pembelajaran harus tetap benar dan relevan. "
        "Jangan membuat konten tentang metadata buku, undang-undang, hak cipta, ISBN, "
        "penerbit, daftar isi, atau informasi administratif. "
        f"Variation seed: {variation_seed}. "
    )

    if jenis_konten == "flashcard":
        return (
            base +
            "Jika versi lama berisi field 'items' berupa array, buat JSON array dengan jumlah item yang sama. "
            "Untuk mode array, JANGAN bungkus dengan object seperti {'items': ...} atau {'flashcards': ...}; "
            "langsung kembalikan array JSON. "
            "Jika versi lama hanya satu object, jawab satu JSON object. Tiap flashcard wajib format "
            '{"pertanyaan": "...", "jawaban": "..."}. '
            "Pertanyaan dan jawaban wajib berbeda jelas dari versi lama.\n\n"
            f"Versi lama:\n{source_json}"
        )
    if jenis_konten == "soal":
        return (
            base +
            "Jika versi lama berisi field 'items' berupa array, buat JSON array dengan jumlah soal yang sama. "
            "Untuk mode array, JANGAN bungkus dengan object seperti {'items': ...}, {'soal': ...}, atau {'bank_soal': ...}; "
            "langsung kembalikan array JSON. "
            "Jika versi lama hanya satu object, jawab satu JSON object. Tiap soal wajib format "
            '{"pertanyaan": "...", "opsi_jawaban": ["...","...","...","..."], '
            '"alasan": "...", "jawaban_benar": "A"}. '
            "JANGAN pakai key lain seperti 'question', 'options', 'answer', atau 'correct_answer'. "
            "Buat soal pilihan ganda baru dengan tepat 4 opsi. Opsi jawaban tidak boleh "
            "sekadar disalin dari versi lama; pengecoh harus masuk akal, dan jawaban_benar "
            "wajib salah satu dari A/B/C/D sesuai urutan opsi.\n\n"
            f"Versi lama:\n{source_json}"
        )
    if jenis_konten == "rangkuman":
        return (
            base +
            "Jawab HANYA dengan JSON array blok konten terstruktur seperti format lama. "
            "JANGAN bungkus dengan object seperti {'konten': ...}, {'blocks': ...}, atau {'rangkuman': ...}; "
            "langsung kembalikan array JSON. "
            "Susun ulang penjelasan, poin penting, dan contoh supaya hasilnya terasa baru "
            "namun tetap membahas inti materi yang sama.\n\n"
            f"Versi lama:\n{source_json}"
        )

    raise ValueError(f"jenis_konten tidak dikenal: {jenis_konten}")


def _contains_non_materi_noise(text: str) -> bool:
    text_lower = (text or "").lower()
    return any(keyword in text_lower for keyword in NON_MATERI_KEYWORDS)


def _collect_strings(value) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        strings = []
        for item in value:
            strings.extend(_collect_strings(item))
        return strings
    if isinstance(value, dict):
        strings = []
        for item in value.values():
            strings.extend(_collect_strings(item))
        return strings
    return []


def _is_non_materi_item(item) -> bool:
    return _contains_non_materi_noise(" ".join(_collect_strings(item)))


def _filter_non_materi_items(parsed, jenis_konten: str):
    """
    Guardrail setelah JSON berhasil diparse. Model kadang tetap membuat item dari
    halaman copyright/metadata walau prompt sudah melarangnya; item seperti itu
    tidak boleh masuk draft guru.
    """
    if isinstance(parsed, list):
        if jenis_konten == "rangkuman":
            filtered_blocks = []
            for block in parsed:
                if isinstance(block, dict) and block.get("type") == "list":
                    clean_items = [
                        item for item in block.get("items", [])
                        if not _contains_non_materi_noise(str(item))
                    ]
                    if clean_items:
                        clean_block = dict(block)
                        clean_block["items"] = clean_items
                        filtered_blocks.append(clean_block)
                elif not _is_non_materi_item(block):
                    filtered_blocks.append(block)
            return filtered_blocks
        return [item for item in parsed if not _is_non_materi_item(item)]

    if isinstance(parsed, dict) and _is_non_materi_item(parsed):
        return None

    return parsed


def generate_content(materi_text: str, jenis_konten: str) -> dict:
    """
    Memanggil LLM provider untuk menghasilkan konten (flashcard/rangkuman/soal).

    Args:
        materi_text: teks materi yang sudah dipreprocess (lihat nlp_processor.py)
        jenis_konten: salah satu dari "flashcard", "rangkuman", "soal"

    Returns:
        dict hasil parse JSON dari response LLM, dengan key "raw_text" sebagai fallback
        jika parsing JSON gagal (supaya guru tetap bisa review manual di frontend).
    """
    config = _get_config()
    prompt = _build_prompt(materi_text, jenis_konten)

    if config["provider"] == "nvidia":
        return _generate_content_nvidia(config, prompt, jenis_konten)

    return _generate_content_gemini(config, prompt, jenis_konten)


def generate_variant(source_content: dict, jenis_konten: str) -> dict:
    config = _get_config()
    prompt = _build_variant_prompt(source_content, jenis_konten)

    if config["provider"] == "nvidia":
        return _generate_content_nvidia(config, prompt, jenis_konten)

    return _generate_content_gemini(config, prompt, jenis_konten)


def _generate_content_nvidia(config: dict, prompt: str, jenis_konten: str) -> dict:
    headers = {
        "Authorization": f"Bearer {config['api_key']}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    temperature = 0.15 if jenis_konten == "soal" else 0.2
    payload = {
        "model": config["model"],
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "top_p": 0.7,
        "max_tokens": 1800,
        "stream": False,
    }

    url = f"{config['base_url'].rstrip('/')}/chat/completions"
    last_error = None
    for attempt in range(1, config["max_retries"] + 2):
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=config["timeout"])

            if response.status_code == 429:
                logger.warning("NVIDIA NIM API rate limited (percobaan %s)", attempt)
                last_error = NIMAPIError("Rate limit tercapai pada NVIDIA NIM API (429).")
                time.sleep(max(config["rate_limit_sleep"], min(2 ** attempt, 8)))
                continue

            response.raise_for_status()
            data = response.json()
            usage = data.get("usage") or None
            content_str = data["choices"][0]["message"]["content"]
            result = _parse_llm_json(content_str, jenis_konten)
            result["token_usage"] = usage
            return result

        except requests.exceptions.HTTPError as e:
            status_code = e.response.status_code if e.response is not None else 500
            safe_error = str(e).replace(config["api_key"], "[redacted]")
            logger.warning("NVIDIA NIM API mengembalikan HTTP error (percobaan %s): %s", attempt, safe_error)
            last_error = NIMAPIError(f"Gagal menghubungi NVIDIA NIM API (status {status_code}): {safe_error}")
            if status_code == 429 or status_code >= 500:
                wait_seconds = max(config["rate_limit_sleep"], min(2 ** attempt, 8)) if status_code == 429 else min(2 ** attempt, 8)
                time.sleep(wait_seconds)
                continue
            raise last_error from None
        except requests.exceptions.RequestException as e:
            safe_error = str(e).replace(config["api_key"], "[redacted]")
            logger.warning("Gagal memanggil NVIDIA NIM API (percobaan %s): %s", attempt, safe_error)
            last_error = NIMAPIError(f"Gagal menghubungi NVIDIA NIM API: {safe_error}")
            time.sleep(min(2 ** attempt, 8))
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            logger.error("Response NVIDIA NIM API tidak sesuai format yang diharapkan: %s", e)
            raise NIMAPIError(f"Response NVIDIA NIM API tidak valid: {e}") from e

    raise (last_error or NIMAPIError("Gagal memanggil NVIDIA NIM API setelah beberapa percobaan.")) from None


def _generate_content_gemini(config: dict, prompt: str, jenis_konten: str) -> dict:

    headers = {"Content-Type": "application/json", "Accept": "application/json"}

    # "soal" pakai temperature lebih rendah dari flashcard/rangkuman: soal (apalagi
    # soal hitung) butuh konsistensi logis, sementara temperature lebih tinggi cuma
    # menambah variasi kalimat tanpa banyak berguna dan malah menaikkan risiko
    # kesalahan hitung/opsi jawaban yang tidak konsisten.
    temperature = 0.15 if jenis_konten == "soal" else 0.4

    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": 1500,
            "responseMimeType": "application/json",
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }

    url = f"{config['base_url']}/models/{config['model']}:generateContent"
    params = {"key": config["api_key"]}

    last_error = None
    for attempt in range(1, config["max_retries"] + 2):  # +2: percobaan awal + retries
        try:
            response = requests.post(url, headers=headers, params=params, json=payload, timeout=config["timeout"])

            if response.status_code == 429:
                # Rate limited: backoff singkat lalu retry (kontrol utama tetap di backend-api queue)
                logger.warning("Gemini API rate limited (percobaan %s)", attempt)
                last_error = NIMAPIError("Rate limit tercapai pada Gemini API (429).")
                time.sleep(max(config["rate_limit_sleep"], min(2 ** attempt, 8)))
                continue

            response.raise_for_status()
            data = response.json()

            usage = data.get("usageMetadata") or None
            content_str = "".join(
                part.get("text", "")
                for part in data["candidates"][0]["content"].get("parts", [])
            )
            if not content_str:
                raise KeyError("candidates[0].content.parts[].text")
            result = _parse_llm_json(content_str, jenis_konten)
            result["token_usage"] = usage  # dipakai caller (routes/generate.py) untuk logging
            return result

        except requests.exceptions.HTTPError as e:
            status_code = e.response.status_code if e.response is not None else 500
            safe_error = str(e).replace(config["api_key"], "[redacted]")
            logger.warning("Gemini API mengembalikan HTTP error (percobaan %s): %s", attempt, safe_error)
            last_error = NIMAPIError(f"Gagal menghubungi Gemini API (status {status_code}): {safe_error}")
            if status_code == 429 or status_code >= 500:
                wait_seconds = max(config["rate_limit_sleep"], min(2 ** attempt, 8)) if status_code == 429 else min(2 ** attempt, 8)
                time.sleep(wait_seconds)
                continue
            else:
                raise last_error from None
        except requests.exceptions.RequestException as e:
            safe_error = str(e).replace(config["api_key"], "[redacted]")
            logger.warning("Gagal memanggil Gemini API (percobaan %s): %s", attempt, safe_error)
            last_error = NIMAPIError(f"Gagal menghubungi Gemini API: {safe_error}")
            time.sleep(min(2 ** attempt, 8))
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            logger.error("Response Gemini API tidak sesuai format yang diharapkan: %s", e)
            raise NIMAPIError(f"Response Gemini API tidak valid: {e}") from e

    raise (last_error or NIMAPIError("Gagal memanggil Gemini API setelah beberapa percobaan.")) from None


def _extract_json_substring(text: str) -> str:
    """
    Cari substring JSON murni di dalam teks yang mungkin dibungkus kalimat
    pembuka/penutup oleh LLM (mis. "Berikut rangkumannya: {...}"). Cari
    tanda kurung pembuka '{' atau '[' PERTAMA dan kurung penutup yang cocok
    TERAKHIR ('}' / ']'), lalu ambil bagian di antaranya.
    Kalau tidak ditemukan pola kurung yang jelas, kembalikan teks apa adanya
    (biar json.loads yang menentukan gagal/berhasil seperti biasa).
    """
    first_brace = text.find("{")
    first_bracket = text.find("[")

    candidates = [i for i in (first_brace, first_bracket) if i != -1]
    if not candidates:
        return text

    start = min(candidates)
    opening_char = text[start]
    closing_char = "}" if opening_char == "{" else "]"
    end = text.rfind(closing_char)

    if end == -1 or end <= start:
        return text

    return text[start:end + 1]


def _escape_raw_control_chars_in_json_strings(text: str) -> str:
    """
    LLM kadang menaruh newline/tab ASLI (bukan escaped '\\n'/'\\t') di dalam
    value string JSON -- ini melanggar spesifikasi JSON (karakter kontrol
    wajib di-escape) sehingga json.loads() gagal dengan
    "Invalid control character". Fungsi ini jalan sebagai state-machine
    sederhana: hanya escape karakter kontrol KETIKA posisi parser sedang di
    dalam string (di antara tanda kutip), supaya whitespace/newline di luar
    string (indentasi JSON, dll) tidak ikut diubah.
    """
    result = []
    in_string = False
    escaped = False

    for ch in text:
        if in_string:
            if escaped:
                result.append(ch)
                escaped = False
            elif ch == "\\":
                result.append(ch)
                escaped = True
            elif ch == '"':
                result.append(ch)
                in_string = False
            elif ch == "\n":
                result.append("\\n")
            elif ch == "\r":
                result.append("\\r")
            elif ch == "\t":
                result.append("\\t")
            else:
                result.append(ch)
        else:
            if ch == '"':
                in_string = True
            result.append(ch)

    return "".join(result)


def _quote_unquoted_string_values(text: str) -> str:
    """
    Beberapa model chat-completion kadang menghasilkan JSON-ish seperti:
      {"pertanyaan": Apa itu fotosintesis?, "jawaban": Proses ...}
    Key sudah benar, tapi value string tidak diberi kutip. Fallback ini hanya
    menargetkan field string yang dipakai aplikasi, lalu membungkus value
    sampai delimiter JSON berikutnya (',' atau '}').
    """
    keys = ("pertanyaan", "jawaban", "alasan", "jawaban_benar", "type", "teks", "title")
    result = []
    i = 0
    while i < len(text):
        matched = False
        for key in keys:
            prefix = f'"{key}":'
            if text.startswith(prefix, i):
                result.append(prefix)
                i += len(prefix)
                while i < len(text) and text[i].isspace():
                    result.append(text[i])
                    i += 1
                if i >= len(text) or text[i] in '"[{':
                    matched = True
                    break

                start = i
                while i < len(text) and text[i] not in ",}\n":
                    i += 1
                value = text[start:i].strip()
                result.append(json.dumps(value, ensure_ascii=False))
                matched = True
                break
        if not matched:
            result.append(text[i])
            i += 1
    return "".join(result)


def _parse_multiple_json_values(text: str):
    """
    Fallback untuk kasus LLM mengembalikan BEBERAPA nilai JSON top-level yang
    terpisah alih-alih SATU array tunggal -- pola yang teramati untuk
    jenis_konten="soal": LLM kadang menaruh kalimat pembuka lalu membuat
    satu array JSON terpisah PER SOAL, mis.:

        Berikut adalah 10 soal pilihan ganda...

        [{"pertanyaan": "..."}]

        [{"pertanyaan": "..."}]

    Ini bukan JSON valid sebagai satu dokumen (json.loads gagal dengan
    "Extra data"). Di sini kita decode nilai JSON satu-satu memakai
    json.JSONDecoder.raw_decode secara berurutan -- setiap kali gagal
    decode dari suatu posisi, cari kurung '[' atau '{' berikutnya dan coba
    lagi dari situ (ini yang menangani teks pembuka non-JSON di awal/antar
    blok). Kalau ditemukan lebih dari satu nilai dan semuanya berupa
    list/dict, gabungkan jadi satu list -- inilah bank soal/flashcard
    lengkapnya. Return None kalau tidak ada >=2 nilai yang bisa digabung
    (biar caller tetap fallback ke raw_text seperti biasa).
    """
    decoder = json.JSONDecoder()
    idx = 0
    length = len(text)
    values = []

    while idx < length:
        while idx < length and text[idx] in " \t\r\n":
            idx += 1
        if idx >= length:
            break
        try:
            value, end_idx = decoder.raw_decode(text, idx)
            values.append(value)
            idx = end_idx
        except json.JSONDecodeError:
            next_bracket = text.find("[", idx + 1)
            next_brace = text.find("{", idx + 1)
            candidates = [p for p in (next_bracket, next_brace) if p != -1]
            if not candidates:
                break
            idx = min(candidates)

    if len(values) <= 1:
        return None

    flattened = []
    for v in values:
        if isinstance(v, list):
            flattened.extend(v)
        elif isinstance(v, dict):
            flattened.append(v)
        else:
            # nilai JSON valid tapi bukan struktur soal/flashcard/rangkuman
            # yang diharapkan (mis. angka/string lepas) -- jangan dipaksakan.
            return None

    return flattened


def _parse_llm_json(content_str: str, jenis_konten: str = "") -> dict:
    """
    Mencoba parse output LLM sebagai JSON. Jika gagal, kembalikan raw_text
    supaya guru tetap bisa melihat & mengedit manual di halaman review draft
    (sesuai prinsip human-in-the-loop, ARCHITECTURE.md bagian 1).

    jenis_konten HANYA dipakai untuk label log (flashcard/rangkuman/soal
    dijalankan paralel lewat ThreadPoolExecutor di routes/generate.py,
    jadi tanpa label ini log sukses/gagal parse tidak bisa dilacak balik
    ke jenis konten mana yang bermasalah).
    """
    cleaned = content_str.strip()
    # LLM kadang membungkus JSON dengan ```json ... ``` — bersihkan dulu.
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    attempts = [cleaned]

    extracted = _extract_json_substring(cleaned)
    if extracted != cleaned:
        attempts.append(extracted)

    # Untuk tiap kandidat teks JSON, coba parse apa adanya dulu, baru kalau
    # gagal coba lagi setelah sanitasi karakter kontrol mentah di dalam string.
    for candidate in list(attempts):
        try:
            parsed = json.loads(candidate)
            parsed = _filter_non_materi_items(parsed, jenis_konten)
            return {"parsed": parsed, "raw_text": content_str}
        except json.JSONDecodeError:
            pass

        sanitized = _escape_raw_control_chars_in_json_strings(candidate)
        if sanitized != candidate:
            try:
                parsed = json.loads(sanitized)
                parsed = _filter_non_materi_items(parsed, jenis_konten)
                logger.info(
                    "Berhasil parse JSON setelah escape karakter kontrol mentah dari LLM "
                    "(jenis_konten=%s).",
                    jenis_konten or "?",
                )
                return {"parsed": parsed, "raw_text": content_str}
            except json.JSONDecodeError:
                pass

        quoted_values = _quote_unquoted_string_values(candidate)
        if quoted_values != candidate:
            try:
                parsed = json.loads(quoted_values)
                parsed = _filter_non_materi_items(parsed, jenis_konten)
                logger.info(
                    "Berhasil parse JSON setelah membungkus value string yang tidak dikutip "
                    "(jenis_konten=%s).",
                    jenis_konten or "?",
                )
                return {"parsed": parsed, "raw_text": content_str}
            except json.JSONDecodeError:
                pass

    # Fallback terakhir: LLM mungkin mengembalikan BEBERAPA nilai JSON
    # top-level terpisah (mis. satu array per soal) alih-alih satu array
    # tunggal -- coba decode berurutan & gabungkan (lihat docstring fungsi).
    for candidate in attempts:
        merged = _parse_multiple_json_values(candidate)
        if merged is not None:
            merged = _filter_non_materi_items(merged, jenis_konten)
            logger.info(
                "Berhasil parse JSON setelah menggabungkan beberapa nilai JSON "
                "top-level terpisah dari LLM (jenis_konten=%s).",
                jenis_konten or "?",
            )
            return {"parsed": merged, "raw_text": content_str}

    logger.warning(
        "Gagal parse JSON dari LLM (jenis_konten=%s), mengembalikan raw_text untuk review manual.",
        jenis_konten or "?",
    )
    return {"parsed": None, "raw_text": content_str}
