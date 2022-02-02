import express, { json, urlencoded } from "express";
const app = express();
const port = process.env.PORT || 8888;
import mongoose from "mongoose";
let { Promise, connect } = mongoose;
import task from "./models/model.js";

app.use(json());
app.use(urlencoded({ extended: true }));

// mongoose instance connection url connection
Promise = global.Promise;
// Replace the following with your Atlas connection string
const connectionUrl = "mongodb://localhost:27017/spotify";
connect(connectionUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

//import routes
import routes from "./routes/routes.js";

//register the route
routes(app);

app.listen(port, () => {
  console.log(`Server running on ${port}`);
});
