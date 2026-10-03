import {handler} from '../server.mjs';
export const config={api:{bodyParser:false}};
export default function(req,res){const url=new URL(req.url,'http://localhost');const route=url.searchParams.get('route');if(route)req.url='/api/'+route;return handler(req,res);}
