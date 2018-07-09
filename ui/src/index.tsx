import { library } from "@fortawesome/fontawesome-svg-core";
import { faDesktop, faMobile, faPlayCircle, faVolumeOff, faVolumeUp } from "@fortawesome/free-solid-svg-icons";
import "bootstrap/dist/css/bootstrap.min.css";
import * as React from "react";
import * as ReactDOM from "react-dom";
import axios from "../node_modules/axios";
import App from "./App";
import "./index.css";
import registerServiceWorker from "./registerServiceWorker";

library.add(faDesktop, faMobile, faVolumeOff, faPlayCircle, faVolumeUp);
axios.defaults.withCredentials = true;

ReactDOM.render(
    <App />,
    document.getElementById("root") as HTMLElement
);
registerServiceWorker();
