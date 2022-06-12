import WebSocket from 'ws'
import {EventEmitter} from 'events'
import {
    ClientToServerMessage as ClientToServerMessageTsProto,
    EmoteEventMessage,
    ErrorMessage,
    GroupDeleteMessage,
    GroupUpdateMessage,
    ItemEventMessage,
    PlayerDetailsUpdatedMessage,
    ServerToClientMessage as ServerToClientMessageTsProto,
    UserJoinedMessage,
    UserLeftMessage,
    UserMovedMessage,
    VariableMessage
} from '../ts-proto-generated/protos/messages'
import Peer from 'simple-peer'

const wrtc = require('wrtc')

let intervalHandle: NodeJS.Timeout

export class User {
    id: number
    uuid: string
    name: string
}

export class WA extends EventEmitter {
    peers = new Map()
    ws: WebSocket
    users: Map<any, User>
    private userId: number;
    public following: boolean = false

    constructor(url: string) {
        super()

        this.ws = new WebSocket(url)
        this.users = new Map()

        this.ws.on('open', this.onOpened.bind(this))
        this.ws.on('message', this.onMessage.bind(this))
        this.ws.on('error', this.onError.bind(this))
        this.ws.on('close', this.onClose.bind(this))
    }

    ping() {
        this.ws.send('')
    }

    onOpened() {
        console.log('opened')
        intervalHandle = setInterval(this.ping.bind(this), 20000)
    }

    onMessage(data: any) {
        try {
            const serverToClientMessage = ServerToClientMessageTsProto.decode(data)

            const message = serverToClientMessage.message;

            switch (message.$case) {
                case "batchMessage":
                    for (const subMessageWrapper of message.batchMessage.payload) {
                        const subMessage = subMessageWrapper.message;
                        if (subMessage === undefined) return;

                        this.handleBatchMessage(subMessage)
                    }
                    break;

                case "roomJoinedMessage":
                    this.userId = message.roomJoinedMessage?.currentUserId
                    console.debug(`Bot user id ${this.userId}`)
                    break;
                case "webRtcStartMessage":
                    let webrtcStartMessage = message.webRtcStartMessage
                    if (!webrtcStartMessage) return

                    let userId = webrtcStartMessage.userId
                    this.createPeer(userId, webrtcStartMessage.initiator)
                    break;
                case "webRtcSignalToClientMessage":
                    let signalMessage = message.webRtcSignalToClientMessage
                    if (!signalMessage) return;
                    let signalSig: any = JSON.parse(signalMessage.signal)
                    if (signalSig.type === 'offer')
                        this.createPeer(signalMessage.userId, true)

                    let p = this.peers.get(signalMessage.userId)
                    p?.signal(signalMessage.signal)
                    break;
                case "followRequestMessage":
                    let followRequest = message.followRequestMessage
                    this.emit("followRequest", this.users.get(followRequest.leader))
                    break
                case "followAbortMessage":
                    let followAbort = message.followAbortMessage
                    this.emit("followAbort", this.users.get(followAbort.leader))
                    break
            }
        } catch (e) {
            console.error(e)
        }
    }

    onError(err: any) {
        console.error(err)
    }

    onClose() {
        console.log('disconnected')
        if (intervalHandle)
            clearInterval(intervalHandle)
    }

    send(message: any) {
        const bytes = ClientToServerMessageTsProto.encode(message).finish();
        this.ws.send(bytes);
    }

    moveBot(position) {
        this.send({
            message: {
                $case: "userMovesMessage",
                userMovesMessage: {
                    position: position,
                    viewport: {left: 0, right: 666, top: 0, bottom: 1536}
                },
            },
        });
    }

    acceptFollowRequest(leader: number) {
        this.following = true;
        this.send({
            message: {
                $case: "followConfirmationMessage",
                followConfirmationMessage: {
                    leader: leader,
                    follower: this.userId,
                }
            },
        });
    }

    stopFollowing(leader: number) {
        this.following = false
        this.send({
            message: {
                $case: "followAbortMessage",
                followAbortMessage: {
                    leader: leader,
                    follower: this.userId,
                }
            }
        });
    }

    sendGlobalMessage(message: string) {
        this.send({
            message: {
                $case: "playGlobalMessage",
                playGlobalMessage: {
                    type: "message",
                    content: JSON.stringify({
                        ops: [{insert: message}]
                    }),
                    broadcastToWorld: false,
                },
            },
        });
    }

    sendAudioMessage(url: string) {
        this.send({
            message: {
                $case: "playGlobalMessage",
                playGlobalMessage: {
                    type: "audio",
                    content: url,
                    broadcastToWorld: false,
                },
            },
        });
    }


    sendMessage(target: User, message: string) {
      let peer = this.peers.get(target.id)
      if (!peer) return
      peer.write(Buffer.from(
          JSON.stringify({
              type: "message",
              message: message,
          }))
      );
    }

    createPeer(userId: number, initiator: boolean) {
        if (!this.peers.has(userId)) {
            this.peers.set(userId, new Peer({initiator: initiator, wrtc: wrtc}))
        }
        let user = this.users.get(userId)
        let peer = this.peers.get(userId)
        peer.on('signal', (data: any) => {
            let message: ClientToServerMessageTsProto = {
                message: {
                    $case: "webRtcSignalToServerMessage",
                    webRtcSignalToServerMessage: {
                        receiverId: userId,
                        signal: JSON.stringify(data),
                    }
                }
            }
            this.send(message)
        })
        peer.on('connect', () => {
            console.debug("connected")
        })
        peer.on('close', () => {
            this.peers.delete(userId)
        })
        peer.on('error', (err: any) => {
            console.error(err)
        })
        peer.on('data', (chunk: Buffer) => {
            const message = JSON.parse(chunk.toString("utf8"));
            if (message.type === "message") {
              this.emit("chatMessage", {
                from: user,
                message: message.message
              })
            }
        })
    }

    private handleBatchMessage(subMessage:
        { $case: "userMovedMessage"; userMovedMessage: UserMovedMessage } |
        { $case: "groupUpdateMessage"; groupUpdateMessage: GroupUpdateMessage } |
        { $case: "groupDeleteMessage"; groupDeleteMessage: GroupDeleteMessage } |
        { $case: "userJoinedMessage"; userJoinedMessage: UserJoinedMessage } |
        { $case: "userLeftMessage"; userLeftMessage: UserLeftMessage } |
        { $case: "itemEventMessage"; itemEventMessage: ItemEventMessage } |
        { $case: "emoteEventMessage"; emoteEventMessage: EmoteEventMessage } |
        { $case: "variableMessage"; variableMessage: VariableMessage } |
        { $case: "errorMessage"; errorMessage: ErrorMessage } |
        { $case: "playerDetailsUpdatedMessage"; playerDetailsUpdatedMessage: PlayerDetailsUpdatedMessage }) {

        switch (subMessage.$case) {
            case "userJoinedMessage":
                let userJoinedMessage = subMessage.userJoinedMessage;
                if (!userJoinedMessage) return;

                this.users.set(userJoinedMessage.userId, {
                    id: userJoinedMessage.userId,
                    uuid: userJoinedMessage.userUuid,
                    name: userJoinedMessage.name
                })
                this.emit('userJoined', {user: userJoinedMessage, position: userJoinedMessage.position})
                break;
            case "userLeftMessage":
                let userLeftMessage = subMessage.userLeftMessage
                if (!userLeftMessage) return;

                let username = this.users.get(userLeftMessage.userId).name
                this.users.delete(userLeftMessage.userId)
                this.emit('userLeft', username)
                break;

            case "userMovedMessage":
                this.emit("userMoved", subMessage.userMovedMessage)
                break
            case "groupUpdateMessage":
                this.emit("groupUpdate", subMessage.groupUpdateMessage)
                break
            case "groupDeleteMessage":
                this.emit("groupDelete", subMessage.groupDeleteMessage)
                break
            case "itemEventMessage":
                this.emit("itemEvent", subMessage.itemEventMessage)
                break
            case "emoteEventMessage":
                this.emit("emoteEvent", subMessage.emoteEventMessage);
                break
            case "variableMessage":
                this.emit("variableMessage", subMessage.variableMessage)
                break
            case "playerDetailsUpdatedMessage":
                this.emit("updateDetails", subMessage.playerDetailsUpdatedMessage)
                break;
            case "errorMessage":
                console.error(`An error message was received ${subMessage.errorMessage.message}`)
                break
        }
    }
}
