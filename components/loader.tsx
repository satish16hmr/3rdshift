import * as React from "react"
import { Loader2 } from "lucide-react"

interface LoaderProps extends React.SVGProps<SVGSVGElement> {
    size?: any;
    className?: string;
    height?:string
}

export const Loader: React.FC<LoaderProps> = ({ size = 8, className,height }) => {
    return (
        <div className={`flex items-center justify-center ${height}`}>
            <Loader2 className={`size-${size} ${className} animate-spin`} />
        </div>
    )
}
