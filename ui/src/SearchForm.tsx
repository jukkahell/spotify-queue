import axios from "axios";
import * as Querystring from "querystring";
import * as React from "react";
import Album, { IAlbumProps } from "./Album";
import Artist, { IArtistProps } from "./Artist";
import config from "./config";
import Playlist, { IPlaylistProps } from "./Playlist";
import Track, { ITrackProps } from "./Track";

interface ISearchFormProps {
    activePlaylistId: string | null;
    isOwner: boolean;
    onQueued: () => void;
    onPlaylistSelected: () => void;
    onError: (msg: string) => void;
}

interface ISearchFormState {
    q: string;
    type: string;
    limit: number;
    tracks: ITrackProps[];
    albums: IAlbumProps[];
    artists: IArtistProps[];
    playlists: IPlaylistProps[];
}

export class SearchForm extends React.Component<ISearchFormProps, ISearchFormState> {

    private readonly defaultLimit = 5;

    public constructor(props: ISearchFormProps) {
        super(props);
        this.state = {
            q: "",
            type: "track,album,artist",
            limit: this.defaultLimit,
            tracks: [],
            albums: [],
            artists: [],
            playlists: []
        };

        this.search = this.search.bind(this);
        this.searchClicked = this.searchClicked.bind(this);
        this.handleChangeEvent = this.handleChangeEvent.bind(this);
        this.selectAlbum = this.selectAlbum.bind(this);
        this.selectArtist = this.selectArtist.bind(this);
        this.hashSearch = this.hashSearch.bind(this);
        this.showMoreTracks = this.showMoreTracks.bind(this);
        this.showMoreArtists = this.showMoreArtists.bind(this);
        this.showMoreAlbums = this.showMoreAlbums.bind(this);
        this.getPlaylists = this.getPlaylists.bind(this);
        this.selectPlaylist = this.selectPlaylist.bind(this);
        this.addToQueue = this.addToQueue.bind(this);
        this.hashSearch();
    }

    public componentDidMount() {
        window.addEventListener("hashchange", this.hashSearch, false);
    }

    public componentWillUnmount() {
        window.removeEventListener("hashchange", this.hashSearch, false);
    }

    public handleChangeEvent(e: React.ChangeEvent<HTMLInputElement>) {
        e.preventDefault();

        this.setState({
            q: e.target.value
        });
    }

    protected hashSearch() {
        const hash = window.location.hash.substr(1);

        if (!hash) {
            this.getPlaylists();
        } else if (hash.indexOf(":") < 0) {
            const searchQuery = decodeURIComponent(hash.replace(/\+/g, " "));
            this.search(searchQuery);
        } else if (hash.indexOf("album") >= 0) {
            const id = window.location.hash.split(":")[1];
            this.selectAlbum(id);
        } else if (hash.indexOf("artist") >= 0) {
            const id = window.location.hash.split(":")[1];
            this.selectArtist(id);
        } else if (hash.indexOf("playlist") >= 0) {
            const id = window.location.hash.split(":")[1];
            this.selectPlaylist(id);
        }
    }

    protected renderPlaylists() {
        if (!this.props.isOwner || this.state.playlists.length === 0) {
            return null;
       }

        const playlists = [
            (<h4 key="playlists">Playlists</h4>)
        ];
        return playlists.concat(this.state.playlists.map((playlist, i) => (
            <Playlist
                name={playlist.name}
                id={playlist.id}
                activeId={this.props.activePlaylistId!}
                key={i + "-" + playlist.id} />
        )));
    }

    protected renderArtists() {
        if (this.state.artists.length === 0) {
            return null;
       }

        const artists = [
            (<h4 key="artists">Artists</h4>)
        ];
        return artists.concat(this.state.artists.map((artist, i) => (
            <Artist
                name={artist.name}
                id={artist.id}
                key={i + "-" + artist.id} />
        )));
    }

    protected selectPlaylist(id: string) {
        axios.put(config.backend.url + "/selectPlaylist", { id })
            .then(() => {
                window.location.hash = "";
                this.props.onPlaylistSelected();
            }).catch(err => {
                this.props.onError(err.response.data.message);
            }
        );
    }

    protected selectArtist(id: string) {
        axios.get(config.backend.url + "/selectArtist?id=" + id)
            .then(response => {
                this.setState({
                    tracks: response.data.tracks,
                    albums: response.data.albums,
                    artists: [],
                    playlists: []
                });
            }).catch(err => {
                this.props.onError(err.response.data.message);
            }
        );
    }

    protected renderAlbums() {
        if (this.state.albums.length === 0) {
            return null;
       }

        const albums = [
            (<h4 key="albums">Albums</h4>)
        ];
        return albums.concat(this.state.albums.map((album, i) => (
            <Album
                name={album.name}
                artist={album.artist}
                id={album.id}
                key={i + "-" + album.id} />
        )));
    }

    protected selectAlbum(id: string) {
        axios.get(config.backend.url + "/selectAlbum?id=" + id)
            .then(response => {
                this.setState({
                    tracks: response.data,
                    albums: [],
                    artists: [],
                    playlists: []
                });
            }).catch(err => {
                this.props.onError(err.response.data.message);
            }
        );
    }

    protected addToQueue(targetId: string, isPlaying: boolean) {
        axios.post(config.backend.url + "/track", { spotifyUri: targetId })
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
            (<h4 key="tracks">Tracks</h4>)
        ];
        return tracks.concat(this.state.tracks.map((track, i) => (
            <Track
                name={track.name}
                artist={track.artist}
                id={track.id}
                duration={track.duration}
                key={i + "-" + track.id}
                isPlaying={false}
                onClick={this.addToQueue} />
        )));
    }

    public searchClicked(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();

        if (this.state.q) {
            this.setState({
                type: "track,album,artist",
                limit: this.defaultLimit
            });
            window.location.hash = "#" + this.state.q;
        } else {
            window.location.hash = "";
        }
    }

    public search(q: string) {
        const params = {
            q,
            type: this.state.type,
            limit: this.state.limit
        };
        axios.get(config.backend.url + "/search?" + Querystring.stringify(params))
            .then(response => {
                this.setState({
                    q,
                    tracks: response.data.tracks,
                    albums: response.data.albums,
                    artists: response.data.artists,
                    playlists: []
                });
            }).catch(err => {
                this.props.onError(err.response.data.message);
            }
        );
    }

    public getPlaylists() {
        axios.get(config.backend.url + "/playlists")
            .then(response => {
                this.setState({
                    tracks: [],
                    albums: [],
                    artists: [],
                    playlists: response.data
                });
            }).catch(err => {
                this.props.onError(err.response.data.message);
            }
        );
    }

    public showMoreTracks(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();
        this.setState({
            type: "track",
            limit: 50,
            playlists: []
        }, () => this.search(this.state.q));
    }

    public showMoreArtists(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();
        this.setState({
            type: "artist",
            limit: 50,
            playlists: []
        }, () => this.search(this.state.q));
    }

    public showMoreAlbums(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();
        this.setState({
            type: "album",
            limit: 50,
            playlists: []
        }, () => this.search(this.state.q));
    }

    public render() {
        return (
            <div className="searchContainer">
                <form className="form-inline searchForm">
                    <input className="form-control search col-md-9" type="text" name="q" value={this.state.q} onChange={this.handleChangeEvent} placeholder="🔍 Search" />
                    <button type="submit" className="btn btn-primary search col-md-2" onClick={this.searchClicked}>Search</button>
                </form>
                <div className="searchResults">
                    {this.renderPlaylists()}
                    {this.renderArtists()}
                    {this.state.artists.length > 4 ? <a href="#" className="showMore" onClick={this.showMoreArtists}>Show more</a> : null}
                    {this.renderAlbums()}
                    {this.state.albums.length > 4 ? <a href="#" className="showMore" onClick={this.showMoreAlbums}>Show more</a> : null}
                    {this.renderTracks()}
                    {this.state.tracks.length > 4 ? <a href="#" className="showMore" onClick={this.showMoreTracks}>Show more</a> : null}
                </div>
            </div>
        );
    }
}

export default SearchForm;
