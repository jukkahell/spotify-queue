import { library } from "@fortawesome/fontawesome-svg-core";
import { faDesktop, faMobile, faPlayCircle, faVolumeOff } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import * as React from "react";
import * as ReactDOM from "react-dom";
import App from "./App";
import config from "./config";
import "./index.css";
import registerServiceWorker from "./registerServiceWorker";

const authorize = () => {
  const client_id = "da6ea27d63384e858d12bcce0fac006d";
  const redirect_uri = config.backend.url + "/callback";
  const url = "https://accounts.spotify.com/authorize" +
      "?client_id=" + client_id +
      "&response_type=code" +
      "&scope=user-modify-playback-state,user-read-currently-playing,user-read-playback-state" +
      "&redirect_uri=" + encodeURIComponent(redirect_uri);

  window.open(url, "SpotiQue", "WIDTH=400,HEIGHT=500");
};

axios.get(config.backend.url + "/isAuthorized")
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
