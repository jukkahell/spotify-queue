import axios from "axios";
import * as React from "react";
import { IAlbumProps } from "./Album";
import { ITrackProps } from "./Track";

export interface IArtistProps {
    name: string;
    id: string;
    onArtistSelected: (tracks: ITrackProps[], albums: IAlbumProps[]) => void;
}

export class Artist extends React.Component<IArtistProps> {

    public constructor(props: IArtistProps) {
        super(props);
        this.selectArtist = this.selectArtist.bind(this);
    }

    protected selectArtist(event: React.MouseEvent<HTMLElement>) {
        event.preventDefault();
        axios.get("http://spotique.fi:8000/selectArtist?id=" + event.currentTarget.id)
            .then(response => {
                this.props.onArtistSelected(response.data.tracks, response.data.albums);
            }).catch(err => {
                console.log(err);
            }
        );
    }

    public render() {
        const {
            name,
            id
        } = this.props;

        return (
            <div>
                <a onClick={this.selectArtist} href="#" id={id}>{name}</a>
            </div>
        );
    }
}

export default Artist;
