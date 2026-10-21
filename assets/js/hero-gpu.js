window.createHeroRenderer = function(canvas){
 const gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'high-performance'});
 if(!gl){canvas.dataset.renderer='canvas2d';return null;}
 let program,textures,images,loc,lost=false;
 function setup(){
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  const v=shader(gl.VERTEX_SHADER,'attribute vec2 p;varying vec2 uv;void main(){gl_Position=vec4(p,0.,1.);uv=vec2((p.x+1.)*.5,(1.-p.y)*.5);}');
  const f=shader(gl.FRAGMENT_SHADER,'precision mediump float;varying vec2 uv;uniform sampler2D a,b;uniform vec2 ca,cb;uniform float t;void main(){gl_FragColor=mix(texture2D(a,(uv-.5)*ca+.5),texture2D(b,(uv-.5)*cb+.5),t);}');
  program=gl.createProgram();gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);gl.deleteShader(v);gl.deleteShader(f);
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const p=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
  loc={};for(const n of ['a','b','ca','cb','t'])loc[n]=gl.getUniformLocation(program,n);
  gl.uniform1i(loc.a,0);gl.uniform1i(loc.b,1);textures=[gl.createTexture(),gl.createTexture()];images=[null,null];
  for(const tex of textures){gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
  canvas.dataset.renderer='webgl';
 }
 setup();canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;});canvas.addEventListener('webglcontextrestored',()=>{setup();lost=false;canvas.dispatchEvent(new Event('hero-renderer-restored'));});
 return {draw(a,b,t){if(lost)return false;b=b||a;
  if(images[1]===a||images[0]===b){textures.reverse();images.reverse();}
  gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);
  [a,b].forEach((img,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,textures[i]);if(images[i]!==img){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);images[i]=img;}const cr=canvas.width/canvas.height,ir=img.width/img.height;gl.uniform2f(i?loc.cb:loc.ca,ir>cr?cr/ir:1,ir>cr?1:ir/cr);});
  gl.uniform1f(loc.t,a===b?0:t);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);return true;
 }};
};
