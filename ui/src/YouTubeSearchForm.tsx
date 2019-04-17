import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import axios from "axios";
import * as React from "react";
import { IUser } from "./App";
import config from "./config";
import { ISettings } from "./Settings";
import Track, { ITrackProps } from "./Track";

interface ISearchObject {
    q: string;
    limit: number;
}

interface IYouTubeSearchFormProps {
    settings: ISettings | null;
    isOwner: boolean;
    user: IUser | null;
    onQueued: () => void;
    onError: (msg: string) => void;
    onToggleFromFavorites: (trackId: string, source: string, isFavorite: boolean) => void;
}

interface IYouTubeSearchFormState {
    search: ISearchObject;
    tracks: ITrackProps[];
}

export class SearchForm extends React.Component<IYouTubeSearchFormProps, IYouTubeSearchFormState> {

    private searchTimeout: NodeJS.Timer;
    private readonly defaultLimit = 20;

    public constructor(props: IYouTubeSearchFormProps) {
        super(props);
        this.state = {
            search: {
                q: "",
                limit: this.defaultLimit,
            },
            tracks: []
        };

        this.search = this.search.bind(this);
        this.executeSearch = this.executeSearch.bind(this);
        this.handleChangeEvent = this.handleChangeEvent.bind(this);
        this.hashSearch = this.hashSearch.bind(this);
        this.addToQueue = this.addToQueue.bind(this);
        this.submitForm = this.submitForm.bind(this);
        this.clearSearch = this.clearSearch.bind(this);
        this.hashSearch();
    }

    public componentDidMount() {
        window.addEventListener("hashchange", this.hashSearch, false);
        document.addEventListener("scroll", this.searchFormScrolled, false);
    }

    public componentWillUnmount() {
        window.removeEventListener("hashchange", this.hashSearch, false);
        document.removeEventListener("scroll", this.searchFormScrolled, false);
    }

    public searchFormScrolled() {
        const searchForm = document.getElementById("searchForm");
        if (searchForm && searchForm.getBoundingClientRect().top < 5) {
            searchForm.classList.add("stuck");
        } else if (searchForm) {
            searchForm.classList.remove("stuck");
        }
    }

    public handleChangeEvent(e: React.ChangeEvent<HTMLInputElement>) {
        e.preventDefault();

        const search = this.state.search;
        search.q = e.target.value;
        if (search.q.length > 2) {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(this.executeSearch, 1000);
        } else {
            window.location.hash = "";
        }
        this.setState({
            search
        });
    }

    public clearSearch() {
        const search = this.state.search;
        search.q = "";
        window.location.hash = "";
        this.setState({
            search
        });
    }

    protected hashSearch() {
        const hash = window.location.hash.substr(1);
        if (!hash) {
            return;
        }

        const search = this.parseHash();

        if (search["q"]) {
            this.state = {
                search: {
                    q: decodeURIComponent(search["q"]),
                    limit: search["limit"] ? search["limit"] : this.defaultLimit
                },
                tracks: []
            };
            this.search();
        }
    }

    protected addToQueue(targetId: string, isPlaying: boolean) {
        axios.post(config.backend.url + "/track", { uri: targetId, source: "youtube" })
            .then(() => {
                this.props.onQueued();
            }).catch(err => {
                this.props.onError(err.response.data.message);
            }
        );
    }

    protected renderTracks() {
        if (this.state.tracks.length === 0) {
             return null;
        }

        const tracks = [
            <h4 key="tracks">Tracks</h4>
        ];
        return tracks.concat(this.state.tracks.map((track, i) => (
            <div className="youtubeVideo" key={i + "-" + track.id}>
                <img className="youtubeCover" src={track.cover} />
                <Track
                    name={track.name}
                    artist={track.artist}
                    id={track.id}
                    trackId={track.trackId}
                    artistId={track.artistId}
                    duration={track.duration}
                    isPlaying={false}
                    protectedTrack={false}
                    owned={false}
                    selectTrack={this.addToQueue}
                    isFavorite={track.isFavorite}
                    toggleFromFavorites={this.props.onToggleFromFavorites} />
            </div>
        )));
    }

    public executeSearch() {
        if (this.state.search.q) {
            this.setState({
                search: {
                    q: this.state.search.q,
                    limit: this.defaultLimit
                }
            }, () => {
                window.location.hash = this.searchToHash(this.state.search);
            });
        } else {
            window.location.hash = "";
        }
    }

    public submitForm(e: any) {
        clearTimeout(this.searchTimeout);
        e.preventDefault();
        this.executeSearch();
    }

    public search() {
        axios.post(config.backend.url + "/youtubeSearch", this.state.search)
            .then(response => {
                this.setState({
                    tracks: response.data
                });
            }).catch(err => {
                this.props.onError(err.response.data.message);
            }
        );
    }

    public render() {
        return (
            <div className="searchContainer">
                <form className="form-inline searchForm" action={config.backend.url + "/search"} method="post" id="searchForm" onSubmit={this.submitForm}>
                    <input type="hidden" name="limit" value={this.defaultLimit} />
                    <input type="hidden" name="q" value={this.state.search.q} />
                    <FontAwesomeIcon className="searchIcon" icon="search" />
                    <input className="form-control search col-md-12" type="text" name="spotiquSearch" value={this.state.search.q} onChange={this.handleChangeEvent} placeholder="Search" />
                    <div className={(this.state.search.q ? "visible" : "invisible") + " clearSearch"} onClick={this.clearSearch}>
                        <FontAwesomeIcon icon="times-circle" />
                    </div>
                </form>
                <div className="searchResults">
                    {this.renderTracks()}
                </div>
            </div>
        );
    }

    private parseHash() {
        return window.location.hash.substr(1)
        .split("&")
        .map(param => param.split("="))
        .reduce((values, [key, value]) => {
            values[key] = value;
            return values;
        }, {});
    }

    private searchToHash(search: any) {
        return "#" + Object.keys(search).map(k => k + "=" + encodeURIComponent(search[k])).join("&");
    }
}

export default SearchForm;
