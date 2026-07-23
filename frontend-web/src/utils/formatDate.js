export function formatDateTime(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  const datePart = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const timePart = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':');
  return `${datePart}, Pukul ${timePart}`;
}
