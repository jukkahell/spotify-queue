import icon from "./Icon"
import * as React from "react";
import { Text, View } from "react-native";
import Duration from "./Duration";

export class Track extends React.Component {

    constructor(props) {
        super(props);

        this.selectTrack = this.selectTrack.bind(this);
        this.selectArtist = this.selectArtist.bind(this);
    }

    selectTrack(e) {
        e.preventDefault();
        this.props.selectTrack(e.currentTarget.id, this.props.isPlaying);
    }

    selectArtist(e) {
        if (this.props.selectArtist) {
            e.preventDefault();
            this.props.selectArtist(e.currentTarget.id, this.props.isPlaying);
        }
    }

    render() {
        const {
            name,
            artist,
            artistId,
            id,
            duration,
            isPlaying
        } = this.props;

        return (
            <View className={this.props.className + (isPlaying ? " currentTrack " : "") + " trackItem"}>
                <View className="trackInfo">
                    <View className="trackName" id={id} onPress={this.selectTrack}>
                        <Text>{name}</Text>
                        {isPlaying 
                            ? <View className="speakerIcon"><Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["volume-up"]}</Text></View>
                            : null}
                    </View>
                    <View className="trackArtist" id={artistId} onPress={this.selectArtist}>
                        <Text>{artist}</Text>
                    </View>
                </View>
                <View className="trackDuration"><Duration milliseconds={duration} /></View>
            </View>
        );
    }
}

export default Track;
