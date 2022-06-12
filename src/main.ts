import config from 'config';
import {User, WA} from './wa';
import {PositionMessage, UserMovedMessage} from "../ts-proto-generated/protos/messages";
import axios from 'axios';
import FormData  from 'form-data';
import stream  from 'stream';
import { promisify } from 'util';
import fs from 'fs';


const url = `ws://${config.get('main.url')}/room`
  + `?roomId=${config.get('main.roomId')}`
  + `&token=${config.get('main.token')}`
  + `&name=${config.get('main.name')}`
  + `&${config.get('main.characterLayers')}`
  + `&x=${config.get('main.position.x')}`
  + `&y=${config.get('main.position.y')}`
  + `&version=dev`
  + `&availabilityStatus=1`
  + `&top=0&bottom=${config.get('main.size.height')}&left=0&right=${config.get('main.size.width')}` // Don't know what that's for... Is it the size of the listen room

  const finished = promisify(stream.finished);

  export async function downloadFile(fileUrl: string, outputLocationPath: string): Promise<any> {
    const writer = fs.createWriteStream(outputLocationPath);
    return axios({
      method: 'get',
      url: fileUrl,
      responseType: 'stream',
    }).then(response => {
      response.data.pipe(writer);
      return finished(writer); //this is a Promise
    });
  }


function main () {
  const wa = new WA(url)

  wa.on('userJoined',  (event: {user: User, position: PositionMessage}) => {
    console.debug(`User ${event.user.name} joined the office`)
  })

  wa.on('userLeft', (user: User) => {
    console.debug(`${user.name} left the office.`)
  })

  wa.on("followRequest", (from: User) => {
    if (wa.following) return
    console.debug("Follow request from: ", from.name)
    wa.acceptFollowRequest(from.id)
  })

  wa.on("followAbort", (from: User) => {
    wa.stopFollowing(from.id)
  })

  wa.on('userMoved', (userMoved: UserMovedMessage) => {
    if (!wa.following) return
    this.moveBot(userMoved.position)
  })

  wa.on("chatMessage", async (event: {from: User, message: string})=> {
    if (event.message.startsWith("/telleveryone ")) {
      wa.sendMessage(event.from, "Ok")
      wa.sendGlobalMessage(`${event.message.replace("/telleveryone ", "")}\n by ${event.from.name}`)
    }
    if (event.message.startsWith("/playtoeveryone ")) {
      let url = event.message.replace("/playtoeveryone ", "")
      wa.sendMessage(event.from, "Ok, will play " + url)

      let fileToSend = "/tmp/" + url.split("/").pop()
      await downloadFile(url, fileToSend)

      const fd = new FormData();
      let fileStats = fs.statSync(fileToSend);
      let stream = fs.createReadStream(fileToSend)
      fd.append("file", stream, { knownLength: fileStats.size });
      const request_config = {
          headers: {
              "Content-Length": fd.getLengthSync(),
              ...fd.getHeaders()
          }
      };
      let res = await axios.post("http://uploader.localtest.me/upload-audio-message", fd, request_config)
      wa.sendAudioMessage(res.data.path)
    }
  })
}

main()
