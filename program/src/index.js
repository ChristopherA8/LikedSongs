// Server
import express from "express";
import request from "request";
import cors from "cors";
import querystring from "querystring";
import cookieParser from "cookie-parser";

// API
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

// filename and dirname in a module
import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Util
import chalk from "chalk";

let client_id = process.env.CLIENT_ID; // Your client id
let client_secret = process.env.CLIENT_SECRET; // Your secret
let redirect_uri = process.env.REDIRECT_URI; // Your redirect uri

let global_refresh_token = process.env.REFRESH_TOKEN || "";
let global_access_token = process.env.ACCESS_TOKEN || "";
let isUpdaterRunning = process.env.RUN_UPDATER || false;

const sleep = (ms) => {
  return new Promise((r) => setTimeout(r, ms));
};

let generateRandomString = function (length) {
  let text = "";
  let possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

// returns colored string with time for console logging
const logPrefix = () => {
  return (
    chalk.whiteBright.bold("|") +
    " " +
    chalk.blue(
      `${new Date().toLocaleTimeString("en-US", {
        timeZone: "America/Chicago",
      })}`
    ) +
    " " +
    chalk.whiteBright.bold("|") +
    " "
  );
};

let stateKey = "spotify_auth_state";

let app = express();

app
  .use(express.static(__dirname + "/public"))
  .use(cors())
  .use(cookieParser());

app.get("/login", function (req, res) {
  let state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  let scope =
    "playlist-modify-public playlist-modify-private playlist-read-private user-library-read";
  res.redirect(
    "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: "code",
        client_id: client_id,
        scope: scope,
        redirect_uri: redirect_uri,
        state: state,
      })
  );
});

app.get("/callback", function (req, res) {
  // your application requests refresh and access tokens
  // after checking the state parameter

  let code = req.query.code || null;
  let state = req.query.state || null;
  let storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect(
      "/#" + new URLSearchParams().append("error", "state_mismatch")
      // querystring.stringify({
      //   error: "state_mismatch",
      // })
    );
  } else {
    res.clearCookie(stateKey);
    let authOptions = {
      url: "https://accounts.spotify.com/api/token",
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: "authorization_code",
      },
      headers: {
        Authorization:
          "Basic " +
          new Buffer.from(client_id + ":" + client_secret).toString("base64"),
      },
      json: true,
    };

    request.post(authOptions, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        let access_token = body.access_token,
          refresh_token = body.refresh_token;

        global_refresh_token = body.refresh_token;
        global_access_token = body.access_token;
        console.log(
          "-------------------------------------------------------------"
        );
        console.log(`refresh_token: ${chalk.green(global_refresh_token)}`);
        console.log(`access_token: ${chalk.green(access_token)}`);
        console.log(
          "-------------------------------------------------------------"
        );
        setup();

        let options = {
          url: "https://api.spotify.com/v1/me",
          headers: { Authorization: "Bearer " + access_token },
          json: true,
        };

        // use the access token to access the Spotify Web API
        request.get(options, function (error, response, body) {
          // console.log(body);
        });

        // we can also pass the token to the browser to make requests from there
        res.redirect(
          "/#" +
            querystring.stringify({
              access_token: access_token,
              refresh_token: refresh_token,
            })
        );
      } else {
        res.redirect(
          "/#" +
            querystring.stringify({
              error: "invalid_token",
            })
        );
      }
    });
  }
});

app.get("/refresh_token", function (req, res) {
  // requesting access token from refresh token
  let refresh_token = req.query.refresh_token;
  let authOptions = {
    url: "https://accounts.spotify.com/api/token",
    headers: {
      Authorization:
        "Basic " +
        new Buffer.from(client_id + ":" + client_secret).toString("base64"),
    },
    form: {
      grant_type: "refresh_token",
      refresh_token: refresh_token,
    },
    json: true,
  };

  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      let access_token = body.access_token;
      res.send({
        access_token: access_token,
      });
    }
  });
});

app.get("/delete_playlist_items", function (req, res) {
  deleteLikedSongsPlaylistTracks(global_access_token);
  console.log("u have no liked songs now\nL");
  res.redirect("/#");
});

app.get("/liked_songs", async function (req, res) {
  console.log("rly liked songs");

  await likedSongs(global_access_token)
    .then((res) => console.log(logPrefix() + res))
    .catch((err) => console.log(logPrefix() + err));
  res.redirect("/#");
});

app.get("/toggle_updater", function (req, res) {
  isUpdaterRunning ? (isUpdaterRunning = false) : (isUpdaterRunning = true);

  console.log("isUpdaterRunning: " + isUpdaterRunning);
  res.redirect("/#");
});

const setup = () => {
  // Startup stuff
  tokenUpdater();
  likedSongsUpdater();
};

const getRefreshedAccessToken = async () => {
  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", global_refresh_token);

  let res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        new Buffer.from(client_id + ":" + client_secret).toString("base64"),
    },
    body: params,
  });
  let data = await res.json();
  return data.access_token;
};

const getLikedSongs = async (
  access_token,
  url = "https://api.spotify.com/v1/me/tracks?limit=50&offset=0",
  likedSongs = new Map()
) => {
  let res = await fetch(url, {
    headers: {
      Authorization: "Bearer " + access_token,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  let data = await res.json();

  if (!data) {
    console.log(
      logPrefix() +
        `Data returned from ` +
        chalk.red(url) +
        " was empty ¯\\_(ツ)_/¯"
    );
    return;
  }

  for (const item of data.items) {
    likedSongs.set(item.track.uri, item.track.name);
  }
  /*   for (const item of data.items) {
    if (item.track.is_playable) {
      if (item.track.linked_from) {
        console.log(JSON.stringify(item.track.linked_from, null, 2));
        likedSongs.set(item.track.linked_from.name, item.track.linked_from.uri);
      } else {
        likedSongs.set(item.track.name, item.track.uri);
      }
    }
  } */

  if (data.next) {
    await sleep(500);
    await getLikedSongs(access_token, data.next, likedSongs);
  }
  return likedSongs;
};

const getLikedSongsPlaylist = async (
  access_token,
  url = `https://api.spotify.com/v1/playlists/${process.env.LIKED_SONGS_ID}/tracks?&limit=50&offset=0`,
  likedSongsMap = new Map()
) => {
  let res = await fetch(url, {
    headers: {
      Authorization: "Bearer " + access_token,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  let data = await res.json();

  if (!data) {
    console.log(
      logPrefix() +
        `Data returned from ` +
        chalk.red(url) +
        " was empty ¯\\_(ツ)_/¯"
    );
    return;
  }

  for (const item of data.items) {
    likedSongsMap.set(item.track.uri, item.track.name);
  }

  if (data.next) {
    await sleep(500);
    await getLikedSongsPlaylist(access_token, data.next, likedSongsMap);
  }
  return { map: likedSongsMap, length: data.total };
};

const deleteSongs = async (body, access_token) => {
  if (body.tracks.length > 100) return console.log("Array exceeds 100 songs");

  let res = await fetch(
    `https://api.spotify.com/v1/playlists/${process.env.LIKED_SONGS_ID}/tracks`,
    {
      method: "DELETE",
      headers: {
        Authorization: "Bearer " + access_token,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  let data = await res.json();
};

const deleteLikedSongsPlaylistTracks = async (access_token) => {
  let { map } = await getLikedSongsPlaylist(access_token);
  let uris = [...map.keys()];

  let body = {
    tracks: [],
  };

  // Split into chunks of 100
  let i,
    j,
    temporary,
    chunk = 100;

  for (i = 0, j = uris.length; i < j; i += chunk) {
    body.tracks = [];
    let urisChunk = uris.slice(i, i + chunk);
    for (let uri of urisChunk) {
      body.tracks.push({ uri: uri });
    }
    await deleteSongs(body, access_token);
  }

  // let res = await fetch(url, {
  //   method: "DELETE",
  //   headers: {
  //     Authorization: "Bearer " + access_token,
  //     Accept: "application/json",
  //     "Content-Type": "application/json",
  //   },
  // });
  // let data = await res.json();

  // for (const item of data.items) {
  //   likedSongsMap.set(item.track.name, item.track.uri);
  // }

  // if (data.next) {
  //   await sleep(3000);
  //   await getLikedSongsPlaylist(access_token, data.next, likedSongsMap);
  // }
  // return { map: likedSongsMap, length: data.total };
};

// This is unused because it includes other stuff too
const getLikedSongsLength = async (access_token) => {
  let res = await fetch(
    "https://api.spotify.com/v1/me/tracks?limit=1&offset=0",
    {
      headers: {
        Authorization: "Bearer " + access_token,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    }
  );
  let data = await res.json();
  return data.total;
};

const getLikedSongsPlaylistLength = async (access_token) => {
  let res = await fetch(
    `https://api.spotify.com/v1/playlists/${process.env.LIKED_SONGS_ID}/tracks?market=US&fields=total&limit=1&offset=0`,
    {
      headers: {
        Authorization: "Bearer " + access_token,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    }
  );
  let data = await res.json();

  if (!data) {
    console.log(
      logPrefix() +
        `Data returned from ` +
        chalk.red(url) +
        " was empty ¯\\_(ツ)_/¯"
    );
    return;
  }

  return data.total;
};

// currently unused cause im muy baka
const getLikedSongsPlaylistSnapshotID = async (access_token) => {
  let res = await fetch(
    `https://api.spotify.com/v1/playlists/${process.env.LIKED_SONGS_ID}?fields=snapshot_id`,
    {
      headers: {
        Authorization: "Bearer " + access_token,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    }
  );
  let data = await res.json();
  return data.snapshot_id;
};

// not tested since postSongs position param was added
// edit: NOT FUNCTIONAL
const copyLikedSongs = async (
  access_token,
  url = "https://api.spotify.com/v1/me/tracks?limit=50&offset=0"
) => {
  let likedSongs = new Map();

  fetch(url, {
    headers: {
      Authorization: "Bearer " + access_token,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  })
    .then((res) => res.json())
    .then(async (res) => {
      for (const item of res.items) {
        // console.log(
        //   `Name: ${item.track.name}, Id: ${item.track.id}, uri: ${item.track.uri}, href: ${item.track.href}, addedAt: ${item.added_at}`
        // );
        likedSongs.set(item.track.name, item.track.uri);
      }
      // console.log(`Limit: ${res.limit}, Next: ${res.next}`);
      // Split into chunks of 50
      let i,
        j,
        temporary,
        songCount = 0,
        chunk = 50;

      for (i = 0, j = [...likedSongs.values()].length; i < j; i += chunk) {
        temporary = [...likedSongs.values()].slice(i, i + chunk);
        await postSongs(temporary.join(","), songCount, access_token);
        songCount += 50;

        // Last iteration of for loop
        if (i + 50 >= [...likedSongs.values()].length) {
          console.log("Done adding songs!");
        }
      }

      // postSongs([...likedSongs.values()].join(","), 0, access_token);
      // recursion go brrr
      if (res.next) copyLikedSongs(access_token, res.next);
    });
};

const postSongs = async (likedSongs, position = 0, access_token) => {
  if (likedSongs.length > 100) return console.log("Array exceeds 100 songs");

  let body = { uris: likedSongs };

  let res = await fetch(
    `https://api.spotify.com/v1/playlists/${process.env.LIKED_SONGS_ID}/tracks?position=${position}`,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + access_token,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  let data = await res.json();

  // console.log(JSON.stringify(data));
};

const likedSongs = async (access_token) => {
  return new Promise(async (resolve, reject) => {
    let playlistLength = await getLikedSongsPlaylistLength(access_token);
    let likedSongsLength = await getLikedSongsLength(access_token);

    if (!likedSongsLength || playlistLength == undefined) {
      reject("Unable to get playlist at this time (╯°□°）╯︵ ┻━┻");
      return;
    }

    console.log(
      logPrefix() +
        `Liked Songs: ${likedSongsLength} Liked Songs Playlist: ${playlistLength}`
    );

    if (likedSongsLength > playlistLength) {
      let likedSongs = await getLikedSongs(access_token);
      let { map } = await getLikedSongsPlaylist(access_token);

      let howManySongsToBeAdded = [...likedSongs.keys()].slice(map.size).length;

      let songsToBeAdded = [...likedSongs.keys()].reverse().slice(map.size);
      if (howManySongsToBeAdded > 1) songsToBeAdded = songsToBeAdded.reverse();

      let songNamesToBeAdded = [...likedSongs.values()]
        .reverse()
        .slice(map.size);
      if (howManySongsToBeAdded > 1)
        songNamesToBeAdded = songNamesToBeAdded.reverse();

      console.log(
        logPrefix() +
          `${
            howManySongsToBeAdded > 1 ? "Added songs:" : "Added song:"
          } ${songNamesToBeAdded.join(", ")}`
      );

      // Split into chunks of 50
      let i,
        j,
        temporary,
        songCount = 0,
        chunk = 50;

      for (i = 0, j = songsToBeAdded.length; i < j; i += chunk) {
        temporary = songsToBeAdded.slice(i, i + chunk);
        await postSongs(temporary, songCount, access_token);
        songCount += 50;

        // Last iteration of for loop
        if (i + 50 >= songsToBeAdded.length) {
          resolve("Done adding songs!");
          return;
        }
      }
    } else {
      resolve("No new songs added, updater run finished successfully!");
      return;
    }
  });
};

const tokenUpdater = async () => {
  // Refresh the access token every 50 minutes
  setInterval(async () => {
    global_access_token = await getRefreshedAccessToken();
    console.log(
      logPrefix() + "Token refreshed: " + chalk.green(global_access_token)
    );
  }, 1000 * 60 * 50);
};

const likedSongsUpdater = async () => {
  // Keep liked songs playlist updated with users liked songs

  async function customInterval() {
    await sleep(30000);

    if (isUpdaterRunning) {
      console.log(logPrefix() + "Updater fired :D");

      let res = await likedSongs(global_access_token)
        .then((res) => console.log(logPrefix() + res))
        .catch((err) => console.log(logPrefix() + err));
    }

    customInterval();
  }
  customInterval();
};

if (!process.env.REFRESH_TOKEN) {
  console.log("Listening on 8888");
  app.listen(8888);
} else {
  global_access_token = await getRefreshedAccessToken();

  console.log("-------------------------------------------------------------");
  console.log(`refresh_token: ${chalk.green(global_refresh_token)}`);
  console.log(`access_token: ${chalk.green(global_access_token)}`);
  console.log("-------------------------------------------------------------");

  setup();
}
