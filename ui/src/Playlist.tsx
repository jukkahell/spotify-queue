import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as React from "react";
import { ISettings } from "./Settings";

export interface IPlaylistProps {
    name: string;
    id: string;
    settings: ISettings | null;
}

export class Album extends React.Component<IPlaylistProps> {

    public constructor(props: IPlaylistProps) {
        super(props);
    }

    public render() {
        const {
            name,
            id,
            settings
        } = this.props;

        return (
            <div>
                <a className={"playlistItem " + (settings && settings.playlist === id ? "active" : "")} href={"#playlist=" + id} id={id}>
                    {name}
                    {settings && settings.playlist === id ? <div className="speakerIcon"><FontAwesomeIcon icon="volume-up" /></div> : null}
                </a>
            </div>
        );
    }
}

export default Album;
