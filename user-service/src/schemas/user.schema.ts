import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  age: number;

  @Prop({ type: Object })
  address: {
    street: string;
    city: string;
    zipCode: string;
    country: string;
  };
  @Prop({ type: Object, default: {} })
  preferences: Record<string, any>;

  @Prop({ default: 'active' })
  status: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ email: 1 });
UserSchema.index({ status: 1, createdAt: -1 });
