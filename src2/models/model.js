import mongoose from "mongoose";
const { Schema, model } = mongoose;

const UserSchema = new Schema({
  username: String,
  id: String,
  refresh_token: String,
  date_created: {
    type: Date,
    default: Date.now,
  },
});

export default model("Users", UserSchema);
