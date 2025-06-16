import type React from "react"
import type { Digest } from "@/lib/database/database-service"
import DigestItem from "@/components/digest-item"

interface DigestsViewProps {
  digests: Digest[]
}

const DigestsView: React.FC<DigestsViewProps> = ({ digests }) => {
  return (
    <div>
      {digests.map((digest) => (
        <DigestItem key={digest.id} digest={digest} />
      ))}
    </div>
  )
}

export default DigestsView
