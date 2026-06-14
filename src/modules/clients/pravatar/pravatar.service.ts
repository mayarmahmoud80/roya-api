import { Injectable } from '@nestjs/common';
//import axios from 'axios';


@Injectable()
export class PravatarService {
    
  constructor(
  ) {}

  async getPravatar(name: string): Promise<string> {
  //  const response = await axios.get(`https://i.pravatar.cc/150?u=${encodeURIComponent(name)}`);
    return `https://i.pravatar.cc/150?u=${encodeURIComponent(name)}`; //response.data;
  }
}


 