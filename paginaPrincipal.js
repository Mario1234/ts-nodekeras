const TAMANIO_IMAGEN=224;
var l_imagenes=[];
var i_numImagenes = 0;
var s_identificador = '';

//----------------------MUESTRA RESULTADOS------------------------------
function muestraResultadosPrediccion(imgPru, clases) {
  const elementoPredicciones = document.getElementById('id-predicciones');
  const contenedorPrediccion = document.createElement('div');
  contenedorPrediccion.className = 'contenedor-predic';

  const contenedorImagen = document.createElement('div');
  contenedorImagen.appendChild(imgPru);
  contenedorPrediccion.appendChild(contenedorImagen);

  const contenedorProbabilidades = document.createElement('div');
  for (let i = 0; i < clases.length; i++) {
    const fila = document.createElement('div');
    fila.className = 'fila';

    const elementoClase = document.createElement('div');
    elementoClase.className = 'celda';
    elementoClase.innerText = clases[i].nombreClase;
    fila.appendChild(elementoClase);

    const elementoProbabilidad = document.createElement('div');
    elementoProbabilidad.className = 'celda';
    elementoProbabilidad.innerText = clases[i].probabilidad.toFixed(3);
    fila.appendChild(elementoProbabilidad);

    contenedorProbabilidades.appendChild(fila);
  }
  contenedorPrediccion.appendChild(contenedorProbabilidades);

  elementoPredicciones.insertBefore(
    contenedorPrediccion, elementoPredicciones.firstChild);
}
//---------------------------------------------------------------------

//----------------------CARGA IMAGENES---------------------------------
const elementoArchivos = document.getElementById('idArchivos');
elementoArchivos.addEventListener('change', evento => {
  let l_archivos = evento.target.files;
  // Muestra thumbnails y un mensaje error al predecir cada imagen
  for (let i = 0; i<l_archivos.length;  i++) {
    f_archivo = l_archivos[i];
    //Solo procesa archivos de imagen, evita otros tipos de archivo
    if (!f_archivo.type.match('image.*')) {
      continue;//sale de esta iteracion y sigue en la siguiente
    }
    let lectorArchivo = new FileReader();//crea un lector para cada archivo

    //capturar informacion del archivo, al terminar de leer el archivo como URL
    lectorArchivo.onload = eventoProgreso => {
      //crea el elem imagen y llama a predecir
      let im_elementoImagen = document.createElement('img');
      im_elementoImagen.src = eventoProgreso.target.result;
      im_elementoImagen.width = TAMANIO_IMAGEN;
      im_elementoImagen.height = TAMANIO_IMAGEN;
      im_elementoImagen.onload = () => {
        l_imagenes[i_numImagenes]=im_elementoImagen;
        i_numImagenes++;
        var contenerdorArchivos = document.getElementById('id-contenedor-archivos');
        var parrafoNombreArchivo = document.createElement('p');
        parrafoNombreArchivo.innerHTML = f_archivo.name;
        contenerdorArchivos.append(parrafoNombreArchivo);
      }
    };

    //lee el archivo como datos de una dir URL
    lectorArchivo.readAsDataURL(f_archivo);
  }
});
//---------------------------------------------------------------------

//-----------------------SUBIR IMAGENES A PREDECIR---------------------
//pide las predicciones de las imagenes de la lista a partir del indice i
async function subirImagenI(resolve,i) {
  var im_elementoImagenActual = l_imagenes[i];
  var s_imagenb64 = im_elementoImagenActual.src;
  var s_json = JSON.stringify({'imagen':s_imagenb64,'id':s_identificador});
  fetch('/subir',
    {
      method: 'POST',
      headers: {'Content-Type':'multipart/form-data'},
      body: s_json
    }
  )
  .then(async function(respuesta) {
    if(respuesta.status!=200){
      var panelEstado = document.getElementById('id-estado');
      panelEstado.innerHTML='error prediciendo';
      resolve(respuesta.status);
    }else{
        resolve(200);
    }
  });
}

//todos los estados de respuesta http deben ser 200 para las peticiones de subida de las imagenes
function todasSubidasBien(li_estado){
  var todasBien = true;
  var i=0;
  while(todasBien && i<l_imagenes.length){
    var i_estado = li_estado[i];
    todasBien = todasBien && (i_estado==200);
    i++;
  }
  return todasBien;
}
//---------------------------------------------------------------------

//------------------SUBIR IMAGENES Y PEDIR PREDICCIONES----------------
//ejecucion de prediccion de prueba, demostracion
async function pideClasificar(){
  s_identificador = '_'+Math.random().toString(36).substr(2,9);
  var l_promesas = [];
  for(i=0;i<l_imagenes.length;i++){
    var p_promesa = new Promise(function(resolve){
      subirImagenI(resolve,i);
    });
    l_promesas.push(p_promesa);
  }
  var li_estado = await Promise.all(l_promesas);   //sube las imagenes en paralelo, bloqueante

  //si se subieron las imagenes bien
  if(todasSubidasBien(li_estado)){
    //pide las predicciones
    var s_json = JSON.stringify({'id':s_identificador});
    fetch('/predecir',
      {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: s_json
      }
    )
    .then(async function(respuesta) {
      if(respuesta.status!=200){
        var panelEstado = document.getElementById('id-estado');
        panelEstado.innerHTML='error prediciendo';
      }else{
        var l_clases = await respuesta.json();
        var i;
        for(i=0;i<l_clases.length;i++){
          //Muestra las clases en el DOM
          muestraResultadosPrediccion(l_imagenes[i], l_clases[i]);      
        }
        l_imagenes=[];//reinicia la lista
        i_numImagenes=0;
        //desactiva el boton
        var bot1 = document.getElementById('idBoton1');
        bot1.disabled=true;
      }
    });
  }
};