import express, { json, urlencoded } from "express";
const app = express();
const port = process.env.PORT || 5555;
import mongoose from "mongoose";
let { Promise, connect } = mongoose;
import task from "./models/model.js";
import fetch from "node-fetch";

app.use(json());
app.use(urlencoded({ extended: true }));

// mongoose instance connection url connection
Promise = global.Promise;
const connectionUrl = "mongodb://localhost:27017/spotify";
connect(connectionUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Check for valid auth token
app.use(async (req, res, next) => {
  let auth_token = req.headers.authorization;
  if (auth_token) {
    // Check if supplied auth_token is valid
    let spotifyRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { authorization: "Bearer " + auth_token },
    });

    let data = await spotifyRes.json();

    if (data.error) {
      res.set("WWW-Authenticate", 'Basic realm="401"'); // change this
      res.status(401).send("Invalid spotify auth token."); // custom message
      return;
    }

    return next();
  } else {
    res.set("WWW-Authenticate", 'Basic realm="401"'); // change this
    res.status(401).send("Authentication required."); // custom message
    return;
  }
});

//import routes
import routes from "./routes/routes.js";

//register the route
routes(app);

app.listen(port, () => {
  console.log(`Server running on ${port}`);
});
