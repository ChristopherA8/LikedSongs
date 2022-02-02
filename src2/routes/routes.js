import {
  listUsers,
  createUser,
  readUser,
  updateUser,
  deleteUser,
} from "../controllers/controller.js";

export default (app) => {
  // User
  app.route("/users").get(listUsers).post(createUser);
  app.route("/users/:userId").get(readUser).put(updateUser).delete(deleteUser);
};
