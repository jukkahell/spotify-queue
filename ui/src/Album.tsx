import axios from "axios";
import * as React from "react";
import { ITrackProps } from "./Track";

export interface IAlbumProps {
    name: string;
    artist: string;
    id: string;
    onAlbumSelected: (tracks: ITrackProps[]) => void;
}

export class Album extends React.Component<IAlbumProps> {

    public constructor(props: IAlbumProps) {
        super(props);
        this.selectAlbum = this.selectAlbum.bind(this);
    }

    protected selectAlbum(event: React.MouseEvent<HTMLElement>) {
        event.preventDefault();
        axios.get("http://spotique.fi:8000/selectAlbum?id=" + event.currentTarget.id)
            .then(response => {
                this.props.onAlbumSelected(response.data);
            }).catch(err => {
                console.log(err);
            }
        );
    }

    public render() {
        const {
            name,
            artist,
            id
        } = this.props;

        return (
            <div>
                <a onClick={this.selectAlbum} href="#" id={id}>{artist} - {name}</a>
            </div>
        );
    }
}

export default Album;
