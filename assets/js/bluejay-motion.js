/* Progressive blur adapted from the supplied Jorge Toloza / Arthur Stammet / Anastadunbar reference.
   One shared GPU canvas; native scrolling, visible-image rendering and accessible image fallback. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const images = [...document.querySelectorAll('.bj-site img')];
  const canvas = document.createElement('canvas');
  canvas.id = 'bj-motion-canvas'; canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const gl = canvas.getContext('webgl', { alpha:true, antialias:false, depth:false, premultipliedAlpha:false });
  const items = images.map(img => {
    const box = document.createElement('div'); box.className = 'bj-motion-media';
    img.before(box); box.append(img);
    if (box.parentElement.classList.contains('bj-coast')) box.classList.add('bj-motion-coast');
    return { img, box, texture:null, src:'', visible:false };
  });
  let program, uniforms, frame=0, last=0, activeUntil=0;
  const vertex = `attribute vec2 position; uniform vec4 rect; uniform vec2 screen; varying vec2 vUv;
    void main(){vUv=vec2(position.x,1.-position.y);vec2 p=rect.xy+position*rect.zw;gl_Position=vec4(p.x/screen.x*2.-1.,1.-p.y/screen.y*2.,0.,1.);}`;
  const fragment = `precision highp float; varying vec2 vUv; uniform sampler2D tMap;
    uniform vec2 imageSize,planeSize,screen; uniform float progress,time,containImage;
    float rand(vec2 co){return fract(sin(dot(co,vec2(12.9898,78.233)))*43758.5453);}
    vec3 sampleImage(vec2 uv){return texture2D(tMap,clamp(uv,0.001,0.999)).rgb;}
    void main(){
      float aspect=planeSize.x/planeSize.y;float ia=imageSize.x/imageSize.y;
      vec2 ratio=vec2(min(aspect/ia,1.),min(ia/aspect,1.));
      if(containImage>.5)ratio=vec2(max(aspect/ia,1.),max(ia/aspect,1.));
      vec2 uv=(vUv-.5)*ratio/1.14+.5;uv.y+=progress*.055;
      if(containImage>.5){uv=(vUv-.5)*ratio*1.06+.5;uv.y+=progress*.025;if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.)))){gl_FragColor=vec4(.98,.976,.96,1.);return;}}
      float y=gl_FragCoord.y/screen.y;
      float gradient=(1.-smoothstep(0.,.25,y))+smoothstep(.78,1.,y);
      float amount=.008*gradient;
      vec3 color=vec3(0.);
      for(int i=0;i<40;i++){
        float f=float(i);vec2 q=vec2(cos(degrees(f/40.*360.)),sin(degrees(f/40.*360.)));
        color+=sampleImage(uv+q*(rand(vec2(f,uv.x+uv.y))+.08)*amount)*.5;
        color+=sampleImage(uv+q*(rand(vec2(f+2.,uv.x+uv.y+24.))+.08)*amount)*.5;
      }
      color/=40.;color-=(1.-rand(uv+time*.0001))*.012*gradient;
      gl_FragColor=vec4(color,1.);
    }`;
  function compile(type, source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;}
  function setup(){
    if(!gl)return;
    program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]),gl.STATIC_DRAW);
    const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
    uniforms=Object.fromEntries(['rect','screen','imageSize','planeSize','progress','time','containImage'].map(k=>[k,gl.getUniformLocation(program,k)]));
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.clearColor(0,0,0,0);
  }
  function fallback(){canvas.hidden=true;items.forEach(i=>i.img.style.opacity='');}
  try{setup();}catch(e){console.warn('Image motion fallback:',e);fallback();return;}
  const observer=new IntersectionObserver(entries=>{entries.forEach(e=>{const i=items.find(i=>i.box===e.target);i.visible=e.isIntersecting;});wake();},{rootMargin:'120px'});
  items.forEach(i=>{observer.observe(i.box);i.img.addEventListener('load',wake);});
  function wake(){activeUntil=performance.now()+220;if(!frame)frame=requestAnimationFrame(render);}
  function render(now){
    frame=0;
    if(reduced.matches||document.hidden){fallback();return;}
    canvas.hidden=false;
    const w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio,1.25);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    if(gl){gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);gl.uniform2f(uniforms.screen,w,h);}
    for(const i of items){
      if(!i.visible)continue;
      const r=i.box.getBoundingClientRect();if(r.bottom<0||r.top>h||!r.width||!r.height)continue;
      const progress=Math.max(-1,Math.min(1,(r.top+r.height/2-h/2)/(h/2+r.height/2)));
      if(!gl){i.img.style.transform=`translate3d(0,${progress*4}%,0) scale(1.14)`;continue;}
      if(!i.img.complete||!i.img.naturalWidth)continue;
      if(i.src!==i.img.currentSrc){
        if(i.texture)gl.deleteTexture(i.texture);i.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,i.texture);
        for(const key of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,key,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,i.img);i.src=i.img.currentSrc;
      }
      gl.bindTexture(gl.TEXTURE_2D,i.texture);gl.uniform4f(uniforms.rect,r.left,r.top,r.width,r.height);
      gl.uniform2f(uniforms.imageSize,i.img.naturalWidth,i.img.naturalHeight);gl.uniform2f(uniforms.planeSize,r.width,r.height);
      // Fragment coordinates are physical pixels, unlike layout coordinates.
      gl.uniform2f(uniforms.screen,canvas.width,canvas.height);
      gl.uniform4f(uniforms.rect,r.left*dpr,r.top*dpr,r.width*dpr,r.height*dpr);
      gl.uniform1f(uniforms.progress,progress);gl.uniform1f(uniforms.time,now/1000);
      gl.uniform1f(uniforms.containImage,i.box.closest('.bj-plan-image')?1:0);
      gl.drawArrays(gl.TRIANGLES,0,6);i.img.style.opacity='0';
    }
    last=now;if(now<activeUntil)frame=requestAnimationFrame(render);
  }
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fallback();});
  canvas.addEventListener('webglcontextrestored',()=>{setup();items.forEach(i=>{i.src='';i.texture=null;});wake();});
  addEventListener('scroll',wake,{passive:true});addEventListener('resize',wake);reduced.addEventListener('change',()=>{items.forEach(i=>i.img.style.transform='');wake();});
  document.addEventListener('visibilitychange',wake);new ResizeObserver(wake).observe(document.querySelector('.bj-site'));wake();
})();
