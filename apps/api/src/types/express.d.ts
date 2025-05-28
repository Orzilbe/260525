// apps/api/src/types/express.d.ts
declare global {
    namespace Express {
      interface Request {
        user?: {
          id: number;
          email: string;
          [key: string]: any;
        }
      }
    }
  }
  
  export {};