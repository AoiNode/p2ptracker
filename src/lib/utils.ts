export function formatIDR(n:number){
  const s = new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Math.round(n));
  return s.replace('Rp','Rp ');
}
