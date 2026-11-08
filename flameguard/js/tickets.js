(() => {
  function ascii(value) {
    return String(value ?? '')
      .replace(/[Łł]/g, (letter) => letter === 'Ł' ? 'L' : 'l')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[–—−]/g, '-')
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function esc(value) { return ascii(value).replace(/([\\()])/g, '\\$1'); }

  function build(booking, language) {
    const labels = {
      en: { title: 'FLAMEGUARD RP TICKET', note: 'ROLEPLAY SERVICE DOCUMENT', from: 'FROM', to: 'TO', date: 'DATE', departure: 'DEPARTURE', operator: 'OPERATOR', seat: 'SEAT', reference: 'BOOKING CODE', fare: 'FARE', status: 'STATUS', confirmed: 'CONFIRMED', cancelled: 'CANCELLED' },
      pl: { title: 'BILET RP FLAMEGUARD', note: 'DOKUMENT PODROZY ROLEPLAY', from: 'Z', to: 'DO', date: 'DATA', departure: 'ODJAZD / ODLOT', operator: 'PRZEWOZNIK', seat: 'MIEJSCE', reference: 'KOD REZERWACJI', fare: 'CENA', status: 'STATUS', confirmed: 'POTWIERDZONA', cancelled: 'ANULOWANA' },
      cs: { title: 'JIZDENKA RP FLAMEGUARD', note: 'DOKLAD ROLEPLAY CESTY', from: 'ODKUD', to: 'KAM', date: 'DATUM', departure: 'ODJEZD / ODLET', operator: 'DOPRAVCE', seat: 'MISTO', reference: 'KOD REZERVACE', fare: 'CENA', status: 'STVRZENA', cancelled: 'ZRUSENA' },
      es: { title: 'BILLETE RP FLAMEGUARD', note: 'DOCUMENTO DE VIAJE ROLEPLAY', from: 'ORIGEN', to: 'DESTINO', date: 'FECHA', departure: 'SALIDA', operator: 'OPERADOR', seat: 'ASIENTO', reference: 'CODIGO DE RESERVA', fare: 'TARIFA', status: 'ESTADO', confirmed: 'CONFIRMADA', cancelled: 'CANCELADA' }
    };
    const c = labels[language] || labels.en;
    const dep = new Date(String(booking.departure_at).replace(' ', 'T'));
    const date = new Intl.DateTimeFormat(language || 'en', { dateStyle: 'long', timeZone: 'Europe/Warsaw' }).format(dep);
    const time = new Intl.DateTimeFormat(language || 'en', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Warsaw' }).format(dep);
    const status = booking.booking_status === 'confirmed' && booking.trip_status === 'published' ? c.confirmed : c.cancelled;
    const lines = [
      '0.08 0.16 0.28 rg 0 650 595 192 re f',
      'BT /F2 24 Tf 48 780 Td (FLAMEGUARD) Tj ET',
      `BT /F2 15 Tf 48 739 Td (${esc(c.title)}) Tj ET`,
      `BT /F1 10 Tf 48 714 Td (${esc(c.note)}) Tj ET`,
      '0.93 0.96 0.99 rg 36 316 523 342 re f',
      '0.82 0.87 0.91 RG 36 316 523 342 re S',
      `BT /F2 10 Tf 55 620 Td (${esc(c.from)}) Tj ET`,
      `BT /F2 10 Tf 320 620 Td (${esc(c.to)}) Tj ET`,
      `BT /F2 26 Tf 55 580 Td (${esc(booking.origin_code)}) Tj ET`,
      `BT /F2 26 Tf 320 580 Td (${esc(booking.destination_code)}) Tj ET`,
      `BT /F1 12 Tf 55 555 Td (${esc(booking.origin_name)}) Tj ET`,
      `BT /F1 12 Tf 320 555 Td (${esc(booking.destination_name)}) Tj ET`,
      '0.79 0.85 0.9 RG 55 528 m 540 528 l S',
      `BT /F2 9 Tf 55 500 Td (${esc(c.date)}) Tj ET`,
      `BT /F2 9 Tf 220 500 Td (${esc(c.departure)}) Tj ET`,
      `BT /F2 9 Tf 380 500 Td (${esc(c.operator)}) Tj ET`,
      `BT /F1 12 Tf 55 475 Td (${esc(date)}) Tj ET`,
      `BT /F1 12 Tf 220 475 Td (${esc(time)}) Tj ET`,
      `BT /F1 12 Tf 380 475 Td (${esc(booking.operator_name)}) Tj ET`,
      `BT /F2 9 Tf 55 432 Td (${esc(c.seat)}) Tj ET`,
      `BT /F1 14 Tf 55 408 Td (${esc(booking.seat_code)}) Tj ET`,
      `BT /F2 9 Tf 220 432 Td (${esc(c.reference)}) Tj ET`,
      `BT /F1 13 Tf 220 408 Td (${esc(booking.booking_code)}) Tj ET`,
      `BT /F2 9 Tf 420 432 Td (${esc(c.fare)}) Tj ET`,
      `BT /F1 13 Tf 420 408 Td (${esc(booking.fare_points)} RP) Tj ET`,
      `BT /F2 9 Tf 55 366 Td (${esc(c.status)}) Tj ET`,
      `BT /F1 12 Tf 55 342 Td (${esc(status)}) Tj ET`,
      '0.08 0.16 0.28 rg 36 244 523 44 re f',
      `BT /F2 11 Tf 55 260 Td (${esc(booking.travel_type === 'train' ? 'FLAMEGUARD RAIL' : 'FLAMEGUARD AIR')}) Tj ET`,
      'BT /F1 9 Tf 48 216 Td (Ticket valid for roleplay within the FlameGuard service.) Tj ET'
    ].join('\n');
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
      `<< /Length ${lines.length} >>\nstream\n${lines}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return new Blob([pdf], { type: 'application/pdf' });
  }

  function download(booking, language) {
    const url = URL.createObjectURL(build(booking, language));
    const link = document.createElement('a');
    link.href = url;
    link.download = `FlameGuard-${booking.booking_code}.pdf`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  window.FlameGuardTickets = { download };
})();
