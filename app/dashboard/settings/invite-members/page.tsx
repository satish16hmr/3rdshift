import { Subheading } from "@/components/heading"
import { Text } from "@/components/text"
import SeatManagement from "@/components/workspace/SeatManagement"

export default function IntegrationsSettings() {

    // const [isOwner, setIsOwner] = useState(null)

    // if (!isOwner) return null

    return (
        <>
            <section className="space-y-3 sm:space-y-4 md:space-y-5">
                <div>
                    <Subheading className="text-lg! text-zinc-800! hidden! lg:flex!">Invite members</Subheading>
                    <Text className="mt-1 text-neutral-500!">
                        Manage who has access to this workspace. Operator workspaces include 2 seats
                    </Text>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white">
                    <SeatManagement />
                </div>
            </section>
        </>
    )
}