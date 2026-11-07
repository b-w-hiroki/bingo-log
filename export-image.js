// Local-only PNG export. This does not publish a sheet or send photos anywhere.
const SheetImage = (() => {
  async function create(sheet, title, getPhotoURL) {
    const canvas=document.createElement('canvas'); canvas.width=1080; canvas.height=1260;
    const ctx=canvas.getContext('2d'); if(!ctx) throw Error('画像を作成できません');
    ctx.fillStyle='#fffaf0';ctx.fillRect(0,0,1080,1260);
    ctx.fillStyle='#34372d';ctx.font='bold 38px sans-serif';ctx.fillText(String(title||'旅の記録').slice(0,24),36,65,1008);
    const cells=[...sheet.cells].sort((a,b)=>a.order-b.order).slice(0,9);
    ctx.font='24px sans-serif';ctx.fillText(`B·log  ·  ${cells.filter(c=>c.status==='completed').length}/9 の思い出`,36,105);
    let missingPhotos=0;
    for(let i=0;i<cells.length;i++) {
      const cell=cells[i],x=36+(i%3)*340,y=140+Math.floor(i/3)*340;
      ctx.fillStyle='#e8e4d8';ctx.fillRect(x,y,328,280);
      if(cell.photoKey) {
        try {
          const url=await getPhotoURL(cell.photoKey);if(!url)throw Error('missing');
          const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=url});
          const scale=Math.max(328/img.width,280/img.height),w=328/scale,h=280/scale;
          ctx.drawImage(img,(img.width-w)/2,(img.height-h)/2,w,h,x,y,328,280);
        } catch {missingPhotos++}
      }
      ctx.fillStyle='#34372d';ctx.font='22px sans-serif';ctx.fillText(`${cell.status==='completed'?'✓ ':''}${String(cell.label||'').slice(0,20)}`,x,y+312,328);
    }
    ctx.font='20px sans-serif';ctx.fillText('この画像には写真とお題が含まれます。共有前に確認してください。',36,1210,1008);
    return {canvas,missingPhotos};
  }
  return {create};
})();
