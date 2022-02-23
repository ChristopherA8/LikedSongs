import apiRequest from "./apiRequest.js";
import dotenv from "dotenv";
dotenv.config();

(async () => {
  let res = await apiRequest(
    `https://api.spotify.com/v1/playlists/${process.env.LIKED_SONGS_ID}/tracks?fields=total&limit=1&offset=0`,
    {
      headers: {
        Authorization:
          "Bearer " +
          "BQC60VBloPwS7ubbmcbrSaqV5zhbsO918DPX__r8ZbprSkOz5-im_VVYVXI_THpYl-o5w8RE49iK1jU0RYEemHf3108e52DWft_knCTw46Qb2hH7B_SxIW8CYYs7cLyp7vUWvWbmVAqtKti0egijVdGJQVytE4VzEH4VPuG8VhZ5iz6o_nqWsfUvlud8zgfn5YDz-PrnqBUDRmWnbPIUuQ1x_p5oTUbKuNEstREVQzgGM5zKQPaKdjEg",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    }
  );
  console.log(typeof res + " " + res.status);
})();

/* setInterval(async () => {
  let res = await apiRequest(
    `https://api.spotify.com/v1/playlists/${process.env.LIKED_SONGS_ID}/tracks?fields=total&limit=1&offset=0`,
    {
      headers: {
        Authorization:
          "Bearer " +
          "BQCPibWwlBnZbn4vm_wD9AxWS8y-DlGPW9v_owTOSyiHxPBLyGgFiAaGGmiVbGc08rJSrxd1pRp649TpAwzUyUnYeGE70HZwDQhoPrSUPZiSYHOmykhmGdJMwBgM5dcNhjHLnkgz7Hu6TPZN6bXVKvQPhpVGVkUyBJMRS_w0FXtAgzY9IdxFbYFUu-xCketrY-MMl3TzuGIC_msy0wlIYhPYYVcR2lXDCTP9BQNB2rlyug9-TLvlf0oR",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    }
  );
  console.log(typeof res + " " + res.status);
}, 1); */
