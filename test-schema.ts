import { SchemaFactory } from '@nestjs/mongoose';
import { Connection, ConnectionSchema } from './src/modules/connections/schemas/connection.schema';
const paths = ConnectionSchema.paths;
for (const [name, path] of Object.entries(paths)) {
  // @ts-ignore
  console.log(name, '->', path.instance, path.options?.ref ? `(ref: ${path.options.ref})` : '');
}
