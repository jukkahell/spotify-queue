import * as React from "react";
import { Text, View } from "react-native";

export class Duration extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <View>
                {this.printTime()}
            </View>
        );
    }

    printTime() {
        let millis = this.props.milliseconds;
        if (!millis) {
            millis = this.props.seconds * 1000;
        }
        const minutes = Math.floor(millis / 60000);
        const seconds = ((millis % 60000) / 1000);
        return <Text>{minutes + ":" + (Math.round(seconds) < 10 ? "0" : "") + seconds.toFixed(0)}</Text>;
    }
}

export default Duration;
