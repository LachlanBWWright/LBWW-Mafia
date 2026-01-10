import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  DrawerLayoutAndroid,
  Vibration,
} from 'react-native';
import { type StackParamList } from '../App';
import { StackActions } from '@react-navigation/native';
import io, { type Socket } from 'socket.io-client';
import { config } from '../config';
import { Time } from '../../shared/socketTypes/socketTypes';

interface Player {
  name: string;
  isAlive?: boolean;
  role?: string;
  isUser?: boolean;
}

interface DayTimeInfo {
  time: Time;
  dayNumber: number;
  timeLeft: number;
}

const socket = io(config.socketUrl);
type GameScreenProps = NativeStackScreenProps<StackParamList, 'GameScreen'>;
export function GameScreen({ route, navigation }: GameScreenProps) {
  const [message, setMessage] = useState('');
  const [playerRole, setPlayerRole] = useState('');
  const [alive] = useState(true);

  const [canTalk, setCanTalk] = useState(true);
  const [time, setTime] = useState<Time>(Time.Day);
  const [dayNumber, setDayNumber] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [messages, addMessage] = useState(new Array<string>());
  const [playerList, setPlayerList] = useState<Player[]>([]);
  const [, setVisiting] = useState<string | null>();
  const [, setVotingFor] = useState<string | null>();

  useEffect(() =>
    navigation.addListener('beforeRemove', e => {
      if (!alive) e.preventDefault();
    })
  , [navigation, alive]);

  useEffect(() => {
    socket.on('receive-message', (inMsg: string) => {
      addMessage(old => [...old, inMsg]);
    });

    socket.on('receive-player-list', (listJson: Player[]) => {
      const list = new Array<Player>();
      listJson.map(instance => {
        list.push(instance);
      });
      setPlayerList(_currentList => list);
    });

    socket.on('receive-new-player', (playerJson: Player) => {
      setPlayerList(list => [...list, playerJson]);
    });

    socket.on('remove-player', (playerJson: Player) => {
      setPlayerList(list => list.filter(item => item.name !== playerJson.name));
    });

    socket.on('assign-player-role', (playerJson: Player) => {
      let tempPlayerList: Player[] = [];
      setPlayerList(list => (tempPlayerList = [...list]));
      const index = tempPlayerList.findIndex(player => player.name === playerJson.name);
      if (index !== -1) {
        // Safe updates
        const p = tempPlayerList[index];
        if (p) {
            p.role = playerJson.role;
            p.isUser = true;
        }
      }
      setPlayerRole(playerJson.role ?? '');
      setPlayerList(tempPlayerList);
    });

    socket.on('update-player-role', (playerJson: Player) => {
      let tempPlayerList: Player[] = [];
      setPlayerList(list => (tempPlayerList = [...list]));
      const index = tempPlayerList.findIndex(player => player.name === playerJson.name);
      if (index !== -1) {
        const p = tempPlayerList[index];
        if (p) {
            if (playerJson.role !== undefined) p.role = playerJson.role;
            p.isAlive = false;
            if (p.isUser) {
                setCanTalk(false);
                Vibration.vibrate([500, 200, 500, 200, 500], false);
            }
        }
      }
      setPlayerList(tempPlayerList);
    });

    socket.on('update-day-time', (infoJson: DayTimeInfo) => {
      setTime(infoJson.time);
      setDayNumber(infoJson.dayNumber);
      setVisiting(null);
      setVotingFor(null);
      let timeLeftVal = infoJson.timeLeft;
      const countDown = setInterval(() => {
        if (timeLeftVal > 0) {
          setTimeLeft(timeLeftVal - 1);
          timeLeftVal--;
        } else {
          clearInterval(countDown);
        }
      }, 1000);
    });

    socket.on('block-messages', () => {
      setCanTalk(false);
    });

    socket.emit('playerJoinRoom', route.params.name, route.params.lobbyId, (callback: number) => {
      if (callback !== 0) navigation.dispatch(StackActions.popToTop());
    });

    return () => {
      socket.off('receive-message');
      socket.off('block-messages');
      socket.off('receive-role');
      socket.off('receive-player-list');
      socket.off('receive-new-player');
      socket.off('remove-player');
      socket.off('update-player-role');
      socket.off('update-player-visit');
      socket.disconnect();
    };
  }, [navigation, route.params.name, route.params.lobbyId]);

  const flatList = React.useRef<FlatList>(null);
  const drawer = React.useRef<DrawerLayoutAndroid>(null);

  return (
    <DrawerLayoutAndroid
      ref={drawer}
      drawerPosition={'right'}
      drawerWidth={300}
      renderNavigationView={() => (
        <FlatList
          data={playerList}
          renderItem={({ item }) => (
            <PlayerInList player={item} socket={socket} setMessage={setMessage} time={time} />
          )}
        />
      )}
    >
      <View
        style={{
          alignSelf: 'stretch',
          marginTop: 'auto',
          flex: 1,
          padding: 20,
        }}
      >
        <Text style={{ justifyContent: 'flex-start', alignSelf: 'center' }}>
          Name: "{route.params.name}" {playerRole != '' ? 'Role: ' + playerRole + ' | ' : ' | '}
          {time}: {dayNumber} | Time Left: {timeLeft}
        </Text>
        <View
          style={{
            backgroundColor: '#CCCCCC',
            flex: 1,
            borderRadius: 10,
            padding: 10,
          }}
        >
          <FlatList
            ref={flatList}
            data={messages}
            renderItem={({ item }) => <Text>{item}</Text>}
            onContentSizeChange={() => {
              if (flatList.current) flatList.current.scrollToEnd();
            }}
          />
        </View>

        {canTalk ? (
          <View
            style={{
              flexDirection: 'row',
              alignSelf: 'stretch',
              marginTop: 'auto',
              paddingVertical: 4,
              justifyContent: 'space-between',
            }}
          >
            <TextInput
              onChangeText={text => {
                setMessage(text);
              }}
              placeholder={'Send a message'}
              value={message}
              style={{
                borderColor: '#0000FF',
                borderWidth: 1,
                borderRadius: 5,
                flex: 1,
                marginRight: 5,
              }}
              numberOfLines={2}
              maxLength={500}
              multiline={true}
              returnKeyType={'send'}
            />
            {message.length != 0 ? (
              <Button
                title="→"
                onPress={() => {
                  socket.emit('messageSentByUser', message);
                  setMessage('');
                }}
                color={'#3333FF'}
              />
            ) : (
              <Button
                title="←"
                onPress={() => {
                  if (drawer.current) drawer.current.openDrawer();
                }}
                color={'#FF0000'}
              />
            )}
          </View>
        ) : (
          <View
            style={{
              alignSelf: 'stretch',
              marginTop: 'auto',
              paddingVertical: 4,
              borderRadius: 10,
              justifyContent: 'flex-end',
            }}
          >
            <Button
              title="Disconnect"
              onPress={() => { navigation.dispatch(StackActions.popToTop()); }}
              color={'#FF0000'}
            />
          </View>
        )}
      </View>
    </DrawerLayoutAndroid>
  );
}

function PlayerInList(props: {
  player: Player;
  socket: Socket;
  setMessage: Dispatch<SetStateAction<string>>;
  time: Time;
}) {
  const [color, setColor] = useState('#FFFFFF');

  useEffect(() => {
    if (props.player.isAlive !== undefined) {
      if (!props.player.isAlive) setColor('#FF0000');
      else if (props.player.isUser === true) setColor('#3333FF');
      else if (props.player.isAlive) setColor('#33FF33');
    }
  }, [props.player.isAlive, props.player.isUser]);

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignSelf: 'stretch',
        flex: 1,
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: color,
        borderWidth: 2,
        borderColor: '#000000',
        borderRadius: 5,
        padding: 5,
        margin: 2,
      }}
    >
      <Text style={{ flexGrow: 1 }}>
        {props.player.name} {props.player.role !== undefined ? '(' + props.player.role + ')' : ''}
      </Text>
      {props.player.isAlive === true && props.player.isUser !== true && (
        <Button title="Whisper" onPress={() => { props.setMessage('/w ' + props.player.name); }} />
      )}
      {props.player.isAlive === true && (
        <Button
          title="Visit"
          onPress={() => props.socket.emit('messageSentByUser', '/c ' + props.player.name)}
        />
      )}
      {props.player.isAlive === true && props.time === Time.Day && (
        <Button
          title="Vote"
          onPress={() => props.socket.emit('messageSentByUser', '/v ' + props.player.name)}
        />
      )}
    </View>
  );
}
