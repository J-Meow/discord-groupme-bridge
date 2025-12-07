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

await sendMessage(
    Deno.env.get("BASE_GROUP")!,
    "Bot started, bridging channels:\n" +
        subgroups.map((x) => "#" + x.name).join("\n") +
        "\nto Discord.",
)
