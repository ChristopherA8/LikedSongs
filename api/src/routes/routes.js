import {
  listUsers,
  createUser,
  readUser,
  updateUser,
  deleteUser,
} from "../controllers/controller.js";

import { getUser } from "../controllers/user.js";

export default (app) => {
  // User
  app.route("/users").get(listUsers).post(createUser);
  app.route("/users/:userId").get(readUser).put(updateUser).delete(deleteUser);

  // Me
  app.route("/me").get(getUser);
};
