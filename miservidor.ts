import * as servidorHttp from "http";
import * as tradURL from "url";
import * as sistemaArchivos from "fs";
import {FuncsRedNeur} from "./funcsredneuronal";
let ahora = require("performance-now");
let puerto : number = process.env.PORT;//9615;
let listasImagenes : Object = {};//string[][];

//<grupo de solicitud> es el conjunto de peticiones de subidas de imagenes y de la peticion de prediccion para clasificar dichas imagenes
//cada grupo identifica una solicitud por parte del cliente de querer clasificar un conjunto de imagenes

//lee el contenido del cuerpo(body) de la peticion y lo devuelve como string de manera asincrona
function leerCuerpo(peticion: servidorHttp.IncomingMessage):Promise<string>{
    return new Promise(function(resolve,reject){
        let acum:string='';
        peticion.on('readable', function() {
            acum += peticion.read();
        });
        peticion.on('end', function() {
            acum=acum.substring(0,acum.length-4);//quita el null del final
            resolve(acum);
        });
    });
}

//atiende la peticion de subir una de las imagenes del <grupo de solicitud>
//funcion asincrona devuelve void, es asincrona para poder usar await
async function atiendeSubir(peticion : servidorHttp.IncomingMessage, respuesta : servidorHttp.ServerResponse):Promise<void>{
    let s_json:string= await leerCuerpo(peticion);     
    let j_idEimagen: any = JSON.parse(s_json);
    let s_imagenBase64:string=j_idEimagen.imagen;//recoge la imagen, es un string con los datos de imagen en b64
    //recoge el identificador que define a que <grupo de solicitud> pertenece esta imagen
    let s_id:string =j_idEimagen.id; 
    console.log('subido por: '+s_id);
    let listaImagenes : string[];
    if(listasImagenes[s_id]==undefined){//si no estaba definida la creamos
        listaImagenes = [];
        //se anaide a la objeto global listasImagenes
        //la lista de imagenes (listaImagenes) de este <grupo de solicitud>
        //se aniade como atributo nuevo del objeto
        listasImagenes[s_id] = listaImagenes;
    }
    else{
        listaImagenes = listasImagenes[s_id];//acceso a un atributo anteriormente creado
    }
    listaImagenes.push(s_imagenBase64);
    //responde que todo ha ido bien
    respuesta.writeHead(200);
    respuesta.end();
}

//atiende la peticion de clasificar cada una de las imagenes del <grupo de solicitud>
//funcion asincrona devuelve void, es asincrona para poder usar await
async function atiendePredecir(peticion : servidorHttp.IncomingMessage, respuesta : servidorHttp.ServerResponse, anfitrionYpuerto:string):Promise<void>{
    let s_json:string= await leerCuerpo(peticion);        
    let j_id : any = JSON.parse(s_json);
    let s_id:string =j_id.id;//recoge el identificador del <grupo de solicitud> de clasificacion de imagenes
    if(s_id!=undefined){
        console.log('prediciendo imagenes de: '+s_id);
        let b_error: boolean = false;
        let listaImagenes : string[] = listasImagenes[s_id];//recoge la lista de imagenes subidas en este <grupo solicitud>
        //console.log(listaImagenes);
        let lp_promesas : Promise<Object>[] = [];
        let l_predicciones : Object[][] = [];//lista de predicciones, cada prediccion es de tipo Object[]
        const tiempoInicio : number = ahora();
        //por cada imagen ejecutar prediccion en red neuronal, para que la clasifique
        let i:number=0;
        while(i<listaImagenes.length && !b_error){
            let frn: FuncsRedNeur = new FuncsRedNeur();
            let j_clases : any = await frn.predecirConModeloMobilenet(listaImagenes[i],anfitrionYpuerto)
            .catch((e)=>{
                console.log("error al predecir: "+e);
                b_error=true;
                respuesta.writeHead(404,{"Content-Type": "text/plain"});
                respuesta.write("error");
                respuesta.end("error");
            }); 
            l_predicciones.push(j_clases);//aniade el resultado de la prediccion a la lista de predicciones
            i++;
        }
        const tiempoTotal : number = ahora() - tiempoInicio;
        console.log(`Clasificadas en ${Math.floor(tiempoTotal)}ms`);
        if(!b_error){
            //si no hubo error envia la lista de predicciones al cliente
            let s_json : string = JSON.stringify(l_predicciones);
            respuesta.writeHead(200,{"Content-Type": "application/json"});
            respuesta.end(s_json);
        }
        listasImagenes[s_id]=undefined;//vacia la lista de imagenes
    }
}

//atendedor de peticiones, todas las posibles
servidorHttp.createServer(function (peticion : servidorHttp.IncomingMessage, respuesta : servidorHttp.ServerResponse) {    
    let urlPeticion: string =(tradURL.parse(peticion.url)).href;
    let anfitrionYpuerto : string = peticion.headers.host;
    //console.log("url pedida: "+urlPeticion);
    if(/.*js$/.test(urlPeticion)){
        console.log("toma js");
        respuesta.writeHead(200,{"Content-Type": "text/javascript"});
        sistemaArchivos.createReadStream("paginaPrincipal.js").pipe(respuesta);
    }
    else if(/.*json$/.test(urlPeticion)){
        console.log("toma json");//devuelve la matriz de la red neuronal, esta peticion la hace el servidor a si mismo
        respuesta.writeHead(200,{"Content-Type": "application/json"});
        sistemaArchivos.createReadStream("model.json").pipe(respuesta);
    }
    else if(/group.*-shard1of1$/.test(urlPeticion)){
        //console.log("toma octet");//devuelve los ficheros de datos de la red neuronal, estas peticiones las hace el servidor a si mismo
        respuesta.writeHead(200,{"Content-Type": "application/octet-stream"});
        //se le quita el caracter barra inclinada
        sistemaArchivos.createReadStream(urlPeticion.substring(1,urlPeticion.length)).pipe(respuesta);
    }
    else if(/.*ico$/.test(urlPeticion)){
        console.log("toma ico");
        respuesta.writeHead(200,{"Content-Type": "image/ico"});
        sistemaArchivos.createReadStream("favicon.ico").pipe(respuesta);
    }
    else if(/.*subir$/.test(urlPeticion)){  
        atiendeSubir(peticion,respuesta);
    }
    else if(/.*predecir$/.test(urlPeticion)){    
        atiendePredecir(peticion,respuesta,anfitrionYpuerto);     
    }
    else{
        console.log("toma html");//pagina principal, es lo que devuelve por defecto
        respuesta.writeHead(200,{"Content-Type": "text/html"});
        sistemaArchivos.createReadStream("paginaPrincipal.html").pipe(respuesta);
    }
}).listen(puerto)   
