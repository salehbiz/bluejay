(() => {
 const form=document.getElementById('bluejay-viewing-form');
 if(!form)return;
 form.addEventListener('submit',event=>{
  event.preventDefault();
  const status=document.getElementById('viewing-status');
  status.hidden=false;
  status.textContent='Booking is not connected yet. Your details have not been sent.';
 });
})();
