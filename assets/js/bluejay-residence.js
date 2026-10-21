(() => {
 const site=document.querySelector('.bj-site'),contact=document.querySelector('#contact');
 if(!site)return;
 let pending=false;
 function update(){pending=false;const below=site.getBoundingClientRect().top<=70;const rect=contact?.getBoundingClientRect();const onDark=rect&&rect.top<=70&&rect.bottom>=70;document.body.classList.toggle('bj-logo-dark',below&&!onDark);document.body.classList.toggle('bj-in-content',below);}
 addEventListener('scroll',()=>{if(!pending){pending=true;requestAnimationFrame(update);}},{passive:true});addEventListener('resize',update);update();
})();