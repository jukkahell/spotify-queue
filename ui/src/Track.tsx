import * as React from "react";


export interface ITrackProps {
    name: string;
    artist: string;
    id: string;
}

export class Track extends React.Component<ITrackProps> {

    public render() {
        const {
            name,
            artist,
            id
        } = this.props;

        return (
            <div>
                <a href={`http://10.4.1.40:8000/addSong?id=` + id}>{artist} - {name}</a>
            </div>
        );
    }
}

export default Track;
