import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import axios from "axios";
import * as React from "react";
import Album, { IAlbumProps } from "./Album";
import { IUser } from "./App";
import Artist, { IArtistProps } from "./Artist";
import config from "./config";
import Playlist, { IPlaylistProps } from "./Playlist";
import { ISettings } from "./Settings";
import Track, { ITrackProps } from "./Track";

interface ISearchObject {
  q: string;
  type: string;
  limit: number;
}

interface ISearchFormProps {
  settings: ISettings | null;
  isOwner: boolean;
  user: IUser | null;
  onQueued: () => void;
  onSavedToSpotify: () => void;
  onPlaylistSelected: () => void;
  onError: (msg: string) => void;
  onToggleFromFavorites: (trackId: string, source: string, isFavorite: boolean) => void;
}

interface ISearchFormState {
  search: ISearchObject;
  tracks: ITrackProps[];
  albums: IAlbumProps[];
  artists: IArtistProps[];
  playlists: IPlaylistProps[];
  title: string;
}

export class SearchForm extends React.Component<ISearchFormProps, ISearchFormState> {

  private searchTimeout: NodeJS.Timer;
  private readonly defaultLimit = 5;
  private readonly defaultTypes = "track,album,artist";

  public constructor(props: ISearchFormProps) {
    super(props);
    this.state = {
      search: {
        q: "",
        type: this.defaultTypes,
        limit: this.defaultLimit,
      },
      tracks: [],
      albums: [],
      artists: [],
      playlists: [],
      title: "Tracks",
    };

    this.search = this.search.bind(this);
    this.executeSearch = this.executeSearch.bind(this);
    this.handleChangeEvent = this.handleChangeEvent.bind(this);
    this.selectAlbum = this.selectAlbum.bind(this);
    this.selectArtist = this.selectArtist.bind(this);
    this.hashSearch = this.hashSearch.bind(this);
    this.showMoreArtists = this.showMoreArtists.bind(this);
    this.showMoreAlbums = this.showMoreAlbums.bind(this);
    this.getPlaylists = this.getPlaylists.bind(this);
    this.selectPlaylist = this.selectPlaylist.bind(this);
    this.addToQueue = this.addToQueue.bind(this);
    this.queuePlaylist = this.queuePlaylist.bind(this);
    this.showMoreTracks = this.showMoreTracks.bind(this);
    this.submitForm = this.submitForm.bind(this);
    this.clearSearch = this.clearSearch.bind(this);
    this.toggleFavorite = this.toggleFavorite.bind(this);
    this.exportToSpotify = this.exportToSpotify.bind(this);
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

  public async toggleFavorite(trackId: string, source: string, isFavorite: boolean) {
    await this.props.onToggleFromFavorites(trackId, source, isFavorite);
    this.hashSearch();
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

  public componentDidUpdate(prevProps: ISearchFormProps) {
    if (prevProps.user !== this.props.user && !window.location.hash.substr(1)) {
      this.getPlaylists();
    }
  }

  protected hashSearch() {
    const hash = window.location.hash.substr(1);
    if (!hash && this.state.playlists.length === 0) {
      this.getPlaylists();
      return;
    }

    const search = this.parseHash();

    if (search["q"]) {
      this.setState({
        search: {
          q: decodeURIComponent(search["q"]),
          type: search["type"] ? decodeURIComponent(search["type"]) : this.defaultTypes,
          limit: search["limit"] ? search["limit"] : this.defaultLimit
        },
        tracks: [],
        albums: [],
        artists: [],
        playlists: [],
        title: "Tracks",
      });
      this.search();
    } else if (search["album"]) {
      this.selectAlbum(search["album"]);
    } else if (search["artist"]) {
      this.selectArtist(search["artist"]);
    } else if (search["playlist"]) {
      this.selectPlaylist(search["playlist"]);
    }
  }

  protected renderPlaylists() {
    if (this.state.playlists.length === 0) {
      return null;
    }

    const playlists = [
      (<h4 key="playlists">Playlists</h4>),
    ];
    return playlists.concat(this.state.playlists.map((playlist, i) => (
      <Playlist
        name={playlist.name}
        id={playlist.id}
        settings={this.props.settings}
        key={i + "-" + playlist.id}
        isOwner={this.props.isOwner}
        addToQueue={this.queuePlaylist} />
    )));
  }

  protected renderArtists() {
    if (this.state.artists.length === 0) {
      return null;
    }

    const artists = [
      <h4 key="artists">Artists</h4>
    ];
    return artists.concat(this.state.artists.map((artist, i) => (
      <Artist
        name={artist.name}
        id={artist.id}
        key={i + "-" + artist.id} />
    )));
  }

  protected async selectPlaylist(id: string) {
    try {
      const playlists = this.state.playlists;
      const playlistName = this.props.settings ? this.props.settings.name : "this queue";
      playlists.unshift({ id: "top", name: "Top songs on " + playlistName, isOwner: false, settings: null, addToQueue: () => null });
      playlists.unshift({ id: "favorites", name: "My Musifer favorites", isOwner: false, settings: null, addToQueue: () => null });
      const path = ["top", "favorites"].includes(id)
        ? `/${id}`
        : "/playlist?id=" + id;
      const trackResponse = await axios.get(config.backend.url + path);
      const playlist = playlists.find((p: IPlaylistProps) => p.id === id);
      const title = playlist ? playlist.name : "";
      this.setState({
        tracks: trackResponse.data.tracks,
        artists: [],
        albums: [],
        playlists: [],
        title,
      });
    } catch (err) {
      this.props.onError(err && err.response && err.response.data && err.response.data.message);
    }
  }

  protected queueFavorites() {
    axios.put(config.backend.url + "/queueFavorites")
      .then(() => {
        this.props.onPlaylistSelected();
      }).catch(err => {
        this.props.onError(err.response.data.message);
      });
  }

  protected queuePlaylist(id: string) {
    axios.put(config.backend.url + "/queuePlaylist", { id })
      .then(() => {
        this.props.onPlaylistSelected();
      }).catch(err => {
        this.props.onError(err.response.data.message);
      });
  }

  protected selectArtist(id: string, isPlaying?: boolean) {
    axios.get(config.backend.url + "/selectArtist?id=" + id)
      .then(response => {
        this.setState({
          tracks: response.data.tracks,
          albums: response.data.albums,
          artists: [],
          playlists: [],
          title: "Tracks",
        });
      }).catch(err => {
        this.props.onError(err.response.data.message);
      });
  }

  protected renderAlbums() {
    if (this.state.albums.length === 0) {
      return null;
    }

    const albums = [
      <h4 key="albums">Albums</h4>
    ];
    return albums.concat(this.state.albums.map((album, i) => (
      <Album
        name={album.name}
        artist={album.artist}
        id={album.id}
        artistId={album.artistId}
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
          playlists: [],
          title: "Tracks",
        });
      }).catch(err => {
        this.props.onError(err.response.data.message);
      });
  }

  protected addToQueue(targetId: string, isPlaying: boolean) {
    axios.post(config.backend.url + "/track", { uri: targetId, source: "spotify" })
      .then(() => {
        this.props.onQueued();
      }).catch(err => {
        this.props.onError(err.response.data.message);
      });
  }

  protected renderTracks() {
    if (this.state.tracks.length === 0) {
      return null;
    }

    const tracks = [];
    tracks.push(
      <h4 key="title">
        {this.state.title}
        {this.state.title === "My Musifer favorites"
          ? <span className="saveToSpotify" title="Save as Spotify playlist" onClick={this.exportToSpotify}><FontAwesomeIcon icon="save" /></span>
          : null}
      </h4>
    );
    return tracks.concat(this.state.tracks.map((track, i) => (
      <Track
        name={track.name}
        artist={track.artist}
        id={track.id}
        trackId={track.id}
        artistId={track.artistId}
        duration={track.duration}
        key={i + "-" + track.id}
        index={i}
        isPlaying={false}
        protectedTrack={false}
        owned={false}
        isFavorite={track.isFavorite}
        selectTrack={this.addToQueue}
        source={track.source}
        votes={track.votes}
        toggleFromFavorites={this.toggleFavorite} />
    )));
  }

  public executeSearch() {
    if (this.state.search.q) {
      this.setState({
        search: {
          q: this.state.search.q,
          type: this.defaultTypes,
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
    axios.post(config.backend.url + "/search", this.state.search)
      .then(response => {
        this.setState({
          tracks: response.data.tracks,
          albums: response.data.albums,
          artists: response.data.artists,
          playlists: [],
          title: "Tracks",
        });
      }).catch(err => {
        this.props.onError(err.response.data.message);
      });
  }

  public exportToSpotify() {
    axios.post(config.backend.url + "/exportFavorites")
      .then(response => {
        this.props.onSavedToSpotify();
      }).catch(err => {
        this.props.onError(err.response.data.message);
      });
  }

  public getPlaylists() {
    const queueName = this.props.settings ? this.props.settings.name : "this queue";
    const top: IPlaylistProps = { id: "top", name: "Top songs on " + queueName, isOwner: false, settings: null, addToQueue: () => this.props.onQueued };
    const favorites: IPlaylistProps = { id: "favorites", name: "My Musifer favorites", isOwner: false, settings: null, addToQueue: () => this.props.onQueued };
    if (this.props.user && this.props.user.spotifyUserId) {
      axios.get(config.backend.url + "/playlists")
        .then(response => {
          const playlists = response.data;
          playlists.unshift(top);
          playlists.unshift(favorites);
          this.setState({
            tracks: [],
            albums: [],
            artists: [],
            playlists,
          });
        }).catch(err => {
          this.props.onError(err.response.data.message);
        });
    } else if (this.props.user) {
      const playlists: IPlaylistProps[] = [];
      playlists.unshift(top);
      playlists.unshift(favorites);
      this.setState({
        tracks: [],
        albums: [],
        artists: [],
        playlists,
      });
    }
  }

  public showMoreArtists(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault();
    this.setState({
      search: {
        q: this.state.search.q,
        type: "artist",
        limit: 50
      }
    }, () => this.search());
    window.location.hash = this.searchToHash(this.state.search);
  }

  public showMoreAlbums(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault();
    this.setState({
      search: {
        q: this.state.search.q,
        type: "album",
        limit: 50
      }
    }, () => this.search());
    window.location.hash = this.searchToHash(this.state.search);
  }

  public showMoreTracks(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault();
    this.setState({
      search: {
        q: this.state.search.q,
        type: "track",
        limit: 50
      }
    }, () => this.search());
    window.location.hash = this.searchToHash(this.state.search);
  }

  public render() {
    return (
      <div className="searchContainer">
        <form className="form-inline searchForm" action={config.backend.url + "/search"} method="post" id="searchForm" onSubmit={this.submitForm}>
          <input type="hidden" name="type" value={this.defaultTypes} />
          <input type="hidden" name="limit" value={this.defaultLimit} />
          <input type="hidden" name="q" value={this.state.search.q} />
          <FontAwesomeIcon className="searchIcon" icon="search" />
          <input className="form-control search col-md-12" type="text" name="spotiquSearch" value={this.state.search.q} onChange={this.handleChangeEvent} placeholder="Search" />
          <div className={(this.state.search.q ? "visible" : "invisible") + " clearSearch"} onClick={this.clearSearch}>
            <FontAwesomeIcon icon="times-circle" />
          </div>
        </form>
        <div className="searchResults">
          {this.renderPlaylists()}
          {this.renderArtists()}
          {this.hasMoreResults() ?
            <a href="#" className="showMore" onClick={this.showMoreArtists}>Show more</a> :
            null
          }
          {this.renderAlbums()}
          {this.hasMoreResults() ?
            <a href="#" className="showMore" onClick={this.showMoreAlbums}>Show more</a> :
            null
          }
          {this.renderTracks()}
          {this.hasMoreResults() ?
            <a href="#" className="showMore" onClick={this.showMoreTracks}>Show more</a> :
            null
          }
        </div>
      </div>
    );
  }

  private hasMoreResults() {
    return this.state.artists.length > 4 && this.state.search.limit < 50 && this.state.search.q;
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
