import { library } from "@fortawesome/fontawesome-svg-core";
import { faDesktop, faMobile, faPlayCircle, faVolumeOff } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import * as React from "react";
import * as ReactDOM from "react-dom";
import App from "./App";
import "./index.css";
import registerServiceWorker from "./registerServiceWorker";
import { env } from "process";

const authorize = () => {
  const client_id = "da6ea27d63384e858d12bcce0fac006d";
  const redirect_uri = "http://spotique.fi:8000/callback";
  const url = "https://accounts.spotify.com/authorize" +
      "?client_id=" + client_id +
      "&response_type=code" +
      "&scope=user-modify-playback-state,user-read-currently-playing,user-read-playback-state" +
      "&redirect_uri=" + encodeURIComponent(redirect_uri);

  window.open(url, "SpotiQue", "WIDTH=400,HEIGHT=500");
};

console.log("ENV: " + env.NODE_ENV);

axios.get("http://spotique.fi:8000/isAuthorized")
    .then(response => {
        if (!response.data.isAuthorized) {
          authorize();
        }
    }).catch(error => {
        console.log(error);
    }
);

library.add(faDesktop, faMobile, faVolumeOff, faPlayCircle);

ReactDOM.render(
    <App />,
    document.getElementById("root") as HTMLElement
);
registerServiceWorker();
