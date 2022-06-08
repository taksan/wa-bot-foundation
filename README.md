# Work Adventure Bot Framework

This project is a basis for building bots for Work Adventure. It was initially based on

https://github.com/rllola/wa-bot

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

