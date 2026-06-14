import mongoose, { Types } from 'mongoose';
import { Connection, ConnectionSchema } from './src/modules/connections/schemas/connection.schema';
(async () => {
  await mongoose.connect('mongodb+srv://islam_db_user:m1xzo5UHFLMlYTtA@cluster0.veurqq7.mongodb.net/roya_plus_new_3');
  const ConnModel = mongoose.model(Connection.name, ConnectionSchema);
  const data: any = {
    dataSourceId: new Types.ObjectId('6a0067e84261cbdd2ea4e231'),
    providerSlug: 'test-prov-' + Date.now(),
    organizationId: '69f338b523add5d2696614e6',
    scope: 'organization',
    status: 'pending',
  };
  const r: any = await ConnModel.create(data);
  console.log('Created _id:', r._id);
  console.log('orgId in returned doc type:', r.organizationId?.constructor?.name);
  const db = mongoose.connection.db!;
  const raw = await db.collection('connections').findOne({ _id: r._id });
  console.log('Raw orgId type:', raw?.organizationId?.constructor?.name);
  await db.collection('connections').deleteOne({ _id: r._id });
  await mongoose.disconnect();
})();
