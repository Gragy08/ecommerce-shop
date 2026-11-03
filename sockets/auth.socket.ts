import { Socket } from "socket.io";
import * as cookie from 'cookie';
import jwt, { JwtPayload } from 'jsonwebtoken';

export const authSocket = (socket: Socket, next: any) => {
  try {
    const cookieString = socket.handshake.headers.cookie;
    if(cookieString) {
      const cookieParsed = cookie.parse(cookieString);
      
      let token: string = "";
      let role: string = "";

      if(cookieParsed.tokenAdmin) {
        token = cookieParsed.tokenAdmin;
        role = "admin";
      } else if(cookieParsed.tokenUser) {
        token = cookieParsed.tokenUser;
        role = "user";
      }

      if(token && role) {
        const decoded = jwt.verify(token, `${process.env.JWT_SECRET}`) as JwtPayload;
        
        if(decoded && decoded.id && decoded.email) {
          socket.data.account = {
            id: decoded.id,
            email: decoded.email,
            role: role
          };
        }
      }
    }
    next();
  } catch (error) {
    console.log(error);
  }
}