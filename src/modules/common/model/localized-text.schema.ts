import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class LocalizedText {
    @Prop({ required: true, default: 'en' })
    public defaultLanguage: string;

    @Prop({ type: Map, of: String, required: true, default: {} })
    public values: Map<string, string>;
}

export const LocalizedTextSchema = SchemaFactory.createForClass(LocalizedText);

