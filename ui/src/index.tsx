import { library } from "@fortawesome/fontawesome-svg-core";
import { fab } from "@fortawesome/free-brands-svg-icons";
import { far } from "@fortawesome/free-regular-svg-icons";
import {
    faArrowCircleUp, faBars, faCheckCircle, faClipboardCheck, faClipboardList, faClone,
    faCog, faDesktop, faDice, faEdit, faExchangeAlt, faForward, faGamepad, faLayerGroup,
    faLink, faMinusCircle, faMobile, faPauseCircle, faPlayCircle, faPlusCircle, faRandom,
    faSave, faSearch, faShare, faShareAlt, faShieldAlt, faSignOutAlt, faSlidersH, faStar,
    faThumbsDown, faThumbsUp, faTimesCircle, faTrashAlt, faUndo, faUnlock, faUser, faUsers,
    faVolumeOff, faVolumeUp,
} from "@fortawesome/free-solid-svg-icons";
import "bootstrap/dist/css/bootstrap.min.css";
import * as React from "react";
import * as ReactDOM from "react-dom";
import axios from "../node_modules/axios";
import App from "./App";
import "./index.css";

library.add(
    faDesktop, faMobile, faVolumeOff, faPlayCircle, faVolumeUp,
    faShareAlt, faLink, faBars, faSlidersH, faSignOutAlt, faUnlock,
    faExchangeAlt, faThumbsDown, faThumbsUp, faTrashAlt, faPauseCircle,
    faForward, faCog, faGamepad, faCheckCircle, faRandom, faPlusCircle,
    faMinusCircle, faClone, faArrowCircleUp, faClipboardCheck, faShare,
    faSearch, faClipboardList, faDice, faLayerGroup, faTimesCircle, faUsers,
    faUndo, faEdit, faSave, faShieldAlt, faUser, faStar, fab, far
);
axios.defaults.withCredentials = true;

ReactDOM.render(
    <App />,
    document.getElementById("root") as HTMLElement
);
