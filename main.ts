async function sendMessage(group: string, message: string) {
    const response = await (
        await fetch(
            "https://api.groupme.com/v3/groups/" + group + "/messages",
            {
                method: "POST",
                headers: {
                    "X-Access-Token": Deno.env.get("GROUPME_TOKEN")!,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: {
                        attachments: [],
                        text: message,
                        source_guid: crypto.randomUUID().replaceAll("-", ""),
                    },
                }),
            },
        )
    ).json()
    if (response.meta.code != 201) {
        console.log(response)
        throw new Error("Message failed to send")
    }
    return response.response
}
async function getMe(): Promise<{ id: string }> {
    const response = await (
        await fetch("https://api.groupme.com/v3/users/me", {
            headers: {
                "X-Access-Token": Deno.env.get("GROUPME_TOKEN")!,
            },
        })
    ).json()
    if (response.meta.code != 200) {
        console.log(response)
        throw new Error("Failed to get user info")
    }
    return response.response
}
async function getSubgroups(
    group: string,
): Promise<{ name: string; id: string }[]> {
    const response = await (
        await fetch(
            "https://api.groupme.com/v3/groups/" + group + "/subgroups",
            {
                headers: {
                    "X-Access-Token": Deno.env.get("GROUPME_TOKEN")!,
                },
            },
        )
    ).json()
    if (response.meta.code != 200) {
        console.log(response)
        throw new Error("Failed to get subgroups")
    }
    return response.response.map((x: { topic: string; id: number }) => ({
        name: x.topic,
        id: x.id.toString(),
    }))
}
const subgroups = (await getSubgroups(Deno.env.get("BASE_GROUP")!))
    .filter((x) => x.name.startsWith("#"))
    .map((x) => ({ ...x, name: x.name.slice(1) }))

const me = await getMe()
console.log(me.id)

const socket = new WebSocket("wss://push.groupme.com/faye")

socket.addEventListener("open", () => {
    console.log("Socket open")
    socket.send(
        JSON.stringify([
            {
                channel: "/user/" + me.id,
                data: { type: "ping" },
                clientId: Deno.env.get("CLIENT_ID"),
                id: "initialconnect",
                ext: { access_token: Deno.env.get("GROUPME_TOKEN") },
            },
        ]),
    )
    socket.send(
        JSON.stringify([
            {
                channel: "/meta/connect",
                connectionType: "websocket",
                clientId: Deno.env.get("CLIENT_ID"),
                id: "initialconnect2",
            },
        ]),
    )
    setInterval(() => {
        console.log("Pong")
        socket.send(
            JSON.stringify([
                {
                    channel: "/user/" + me.id,
                    data: { type: "ping" },
                    clientId: Deno.env.get("CLIENT_ID"),
                    id: Math.random().toString().slice(2),
                    ext: { access_token: Deno.env.get("GROUPME_TOKEN") },
                },
            ]),
        )
    }, 30000)
})

socket.addEventListener("message", (ev) => {
    console.log("Socket message", ev.data)
    const data = JSON.parse(ev.data)
    function handleMessage(message: {
        id: string
        data?: {
            type: string
            subject?: {
                sender_id: string
                sender_type: string
                text: string
                group_id: string
            }
        }
    }) {
        if (!("data" in message)) {
            return
        }
        const data = message.data!
        const type = data.type
        if (type == "ping") {
            console.log("Ping")
        }
        if (type == "line.create") {
            if (data.subject!.sender_id == me.id) return
            if (data.subject!.sender_type != "user") return
            if (
                subgroups.filter((x) => x.id == data.subject!.group_id)
                    .length == 0
            )
                return
            console.log(
                data.subject!.text,
                data.subject!.group_id,
                subgroups.filter((x) => x.id == data.subject!.group_id)[0].name,
            )
        }
    }
    // @ts-expect-error ugh i don't want to write this stuff
    data.forEach((x) => handleMessage(x))
})

socket.addEventListener("close", () => {
    console.log("Socket closed")
})

socket.addEventListener("error", (ev) => {
    console.log("Socket error", ev)
})

await sendMessage(
    Deno.env.get("BASE_GROUP")!,
    "Bot started, bridging channels:\n" +
        subgroups.map((x) => "#" + x.name).join("\n") +
        "\nto Discord.",
)
