/* promptpay.js — build an EMVCo-compliant PromptPay QR payload string, client-side.
   No external service. The string is rendered to an actual QR image by app.js using
   a QR library loaded in index.html.

   PromptPay ID may be a mobile number (0812345678) or national/tax ID (13 digits).
   Amount is optional; if provided, the QR is a fixed-amount request. */

function _tlv(id, value){
  const len = String(value.length).padStart(2,'0');
  return id + len + value;
}

/* CRC-16/CCITT-FALSE checksum over the payload (poly 0x1021, init 0xFFFF). */
function _crc16(str){
  let crc = 0xFFFF;
  for(let i=0;i<str.length;i++){
    crc ^= str.charCodeAt(i) << 8;
    for(let j=0;j<8;j++){
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4,'0');
}

/* Normalise a PromptPay target into the AID sub-field. */
function _target(id){
  const digits = String(id).replace(/\D/g,'');
  if(digits.length === 13){
    // National ID / Tax ID -> tag 02
    return _tlv('02', digits);
  }
  // Mobile number -> tag 01, formatted as 0066 + number without leading 0
  let m = digits;
  if(m.startsWith('0')) m = m.slice(1);
  return _tlv('01', '0066' + m);
}

/* Build the full PromptPay payload. amount is a Number or falsy. */
function buildPromptPayPayload(promptpayId, amount){
  if(!promptpayId) return '';
  const aid = _tlv('00', 'A000000677010111');
  const merchant = _tlv('29', aid + _target(promptpayId));
  const payloadFormat = _tlv('00', '01');
  const poiMethod = _tlv('01', amount ? '12' : '11'); // 12 = dynamic (has amount), 11 = static
  const country = _tlv('58', 'TH');
  const currency = _tlv('53', '764'); // THB
  let body = payloadFormat + poiMethod + merchant + country + currency;
  if(amount){
    const amt = Number(amount).toFixed(2);
    body += _tlv('54', amt);
  }
  body += '6304'; // CRC tag + length placeholder
  const crc = _crc16(body);
  return body + crc;
}

window.CM_PROMPTPAY = { buildPromptPayPayload };
