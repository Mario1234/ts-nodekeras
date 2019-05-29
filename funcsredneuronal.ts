import * as tensorflow from '@tensorflow/tfjs-node';
import {IMAGENET_CLASSES} from './imagenet_classes';
import * as libreriaCanvas from 'canvas';
let ahora = require("performance-now");

export class FuncsRedNeur {  

  private TAMANIO_IMAGEN: number = 224;//120
  private TOPX_PREDICCIONES: number = 10;
  private modeloMobileNet: tensorflow.LayersModel;
  private b_modeloCargado : boolean;
  
  constructor() {
    this.b_modeloCargado = false;
  }

  //metodo general que recibe una imagen y la devuelve clasificada utilizando mobilenet con tensorflow
  public async predecirConModeloMobilenet(s_imagenBase64: string, anfitrionYpuerto: string):Promise<Object[]>{
    //crea una imagen y utilizando canvas la pinta en el
    let ancho : number = this.TAMANIO_IMAGEN;//940;//75;
    let alto : number = this.TAMANIO_IMAGEN;//624;//64;
    const canvas : libreriaCanvas.Canvas = libreriaCanvas.createCanvas(ancho,alto);    
    const ctx : CanvasRenderingContext2D = canvas.getContext('2d');
    var imagen : any = new libreriaCanvas.Image;
    imagen.src=s_imagenBase64;
    ctx.drawImage(imagen, 0, 0, ancho, alto);   
    let elementoCanvas : HTMLCanvasElement = ctx.canvas;
    //la primera peticion de prediccion carga el modelo, las siguientes utilizan el que esta cargado
    if(!this.b_modeloCargado){
      //el servidor pide la matriz de la red neuronal a si mismo
      console.log('Cargando modelo...');
      let camino : string = 'http://' + anfitrionYpuerto + '/model.json';
      console.log(camino);
      this.modeloMobileNet = await tensorflow.loadLayersModel(camino);
      console.log('Modelo cargado');
      this.b_modeloCargado=true;
      //calienta el modelo
      this.modeloMobileNet.predict(tensorflow.zeros([1, this.TAMANIO_IMAGEN, this.TAMANIO_IMAGEN, 3]));//.dispose();
    }
    //predice, se le pasa el canvas con la imagen pintada
    return this.predecir(elementoCanvas);
  }

  private async predecir(elementoCanvas: HTMLCanvasElement) :Promise<Object[]>{ 
    //operaciones de predicion con mobilenet   
    const mapaProbabilidades : tensorflow.Tensor = tensorflow.tidy(() => {
      console.log('Convolucionando imagen');
      // tf.fromPixels() devuelve el tensor de los pixeles de la imagen (imagen en bytes para mi)   
      const imagenBytes: tensorflow.Tensor<tensorflow.Rank.R3> = tensorflow.browser.fromPixels(elementoCanvas).toFloat();
      const desplazamiento: tensorflow.Tensor<tensorflow.Rank.R0> = tensorflow.scalar(127.5);
      // Normaliza la imagen de [0, 255] a [-1, 1]
      //tensorflow.Tensor<tensorflow.Rank.R3>
      const imagenNormalizada: tensorflow.Tensor = imagenBytes.sub(desplazamiento).div(desplazamiento);

      //redimensiona la imagen para que tenga solo una dimension y pueda meterla en la red neuronal
      //tensorflow.ShapeMap[tensorflow.Rank.R2] = [this.TAMANIO_IMAGEN, this.TAMANIO_IMAGEN];
      let siluetaMapa : any = [1, this.TAMANIO_IMAGEN, this.TAMANIO_IMAGEN, 3];
      const imagenUnaDim: tensorflow.Tensor<tensorflow.Rank.R2> = imagenNormalizada.reshape(siluetaMapa);
      console.log('Imagen convolucionada');
      console.log('Comienza prediccion...');
      //La red predice la clase de la imagen, llamada a la libreria TensorFlow
      return this.modeloMobileNet.predict(imagenUnaDim) as tensorflow.Tensor;
    }); 

    //predecir devuelve la promesa prediceMasProbables(medir tiempo y traduce clases)
    //prediceMasProbables espera que se resuelva la promesa dameXPrimerasPredicciones (traduce nombres de clases)
    //dameXPrimerasPredicciones espera que se resuelva la promesa mapaProbabilidades.data() (espera fin de la prediccion con mobilenet)
    //mapaProbabilidades.data() espera a que termine el modeloMobileNet.predict (hace la prediccion con mobilenet)
    return this.dameXPrimerasPredicciones(mapaProbabilidades, this.TOPX_PREDICCIONES); 
  }

  private async dameXPrimerasPredicciones(mapaProbabilidades:tensorflow.Tensor,topX: number) :Promise<Object[]>{
    console.log('Prediciendo...');
    const tiempoInicio : number = ahora();
    const valoresMapa : Float32Array | Int32Array | Uint8Array = await mapaProbabilidades.data();
    console.log('Prediccion terminada');
    const tiempoTotal : number = ahora() - tiempoInicio;
    console.log(`Hecho en ${Math.floor(tiempoTotal)}ms`);

    const valoresIndices:ObjetoProbabilidad[] = [];
    for (let i = 0; i < valoresMapa.length; i++) {
      let objProb: ObjetoProbabilidad = {valor: valoresMapa[i], indice: i};
      valoresIndices.push(objProb);
    }
    valoresIndices.sort((a:ObjetoProbabilidad, b:ObjetoProbabilidad) => {
      return b.valor - a.valor;
    });
    const topXValues:Float32Array = new Float32Array(topX);
    const topXIndices:Int32Array = new Int32Array(topX);
    for (let i = 0; i < topX; i++) {
      topXValues[i] = valoresIndices[i].valor;
      topXIndices[i] = valoresIndices[i].indice;
    }
    const topClasesProbs:Object[] = [];
    for (let i = 0; i < topXIndices.length; i++) {
      topClasesProbs.push({
        nombreClase: IMAGENET_CLASSES[topXIndices[i]],
        probabilidad: topXValues[i]
      })
    }
    let promesaClases:Promise<Object[]> = new Promise(function(resolve, reject) {resolve(topClasesProbs)});
    return promesaClases;
  }

}

class ObjetoProbabilidad {
  public valor:number;
  public indice:number;
}
