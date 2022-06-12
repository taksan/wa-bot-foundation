# Work Adventure Bot Framework

This project is a basis for building bots for Work Adventure. It was inspired by [rllola](https://github.com/rllola/wa-bot) 
project, but uses a very different approach. In a way, this bot framework is a minimalistic "frontend" module and will try
to connect directly to pusher by websocket.

To encode and decode the pusher messages, it uses the files in the `ts-proto-generated` directory. If, for some reason, the
bot doesn't work as expected, it might be due to incompatible `messages.ts` file. You can try to update this directory
cloning [workadventure project](https://github.com/thecodingmachine/workadventure) and running the following commands:

```shell
cd workadventure/messages
yarn run ts-proto
```

The command will generate the `ts-proto-generated` directory. Just copy the directory entirely over this project's one.

## Deploy

### Configuration

Under the `config/` folder create a `default.toml` (for development) file and a `production.toml` (for production).

example.toml
```
[main]
url = "pusher.<workadventure-url>"
token = "<workadventure-token>"
name = "My Bot"
roomId = "<workadevture-roomId>"
characterLayers = "characterLayers=color_13&characterLayers=eyes_22&characterLayers=hair_1&characterLayers=clothes_10&characterLayers=hats_1&characterLayers=accessory_1"

[main.position]
x = 1200
y = 900

```

### Start

```
$ yarn run start
```

### Docker

```
$ docker build -t wa-bot .
$ docker run -v "$(pwd)"/config:/usr/src/app/config wa-bot
```

