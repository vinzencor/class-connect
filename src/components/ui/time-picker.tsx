import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Clock } from "lucide-react";

interface TimePickerProps {
    value: string;
    onChange: (time: string) => void;
    placeholder?: string;
    className?: string;
}

const hours12 = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const minutes = ['00', '15', '30', '45'];

export function TimePicker({ value, onChange, placeholder = "Select time", className }: TimePickerProps) {
    const [open, setOpen] = React.useState(false);

    // Parse current value
    const parseTime = (timeStr: string) => {
        if (!timeStr) return { hour: '', minute: '', period: 'AM' };
        const [h, m] = timeStr.split(':');
        const hour24 = parseInt(h, 10);
        const period = hour24 >= 12 ? 'PM' : 'AM';
        const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
        return {
            hour: hour12.toString().padStart(2, '0'),
            minute: m || '00',
            period
        };
    };

    const { hour, minute, period } = parseTime(value);

    const formatTime = (h: string, m: string, p: string) => {
        if (!h || !m) return '';
        let hour24 = parseInt(h, 10);
        if (p === 'PM' && hour24 !== 12) hour24 += 12;
        if (p === 'AM' && hour24 === 12) hour24 = 0;
        return `${hour24.toString().padStart(2, '0')}:${m}`;
    };

    const handleHourChange = (newHour: string) => {
        const newTime = formatTime(newHour, minute || '00', period);
        onChange(newTime);
    };

    const handleMinuteChange = (newMinute: string) => {
        const newTime = formatTime(hour || '12', newMinute, period);
        onChange(newTime);
    };

    const handlePeriodChange = (newPeriod: string) => {
        const newTime = formatTime(hour || '12', minute || '00', newPeriod);
        onChange(newTime);
    };

    const displayTime = value ?
        `${hour}:${minute} ${period}` :
        placeholder;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !value && "text-muted-foreground",
                        className
                    )}
                >
                    <Clock className="mr-2 h-4 w-4" />
                    {displayTime}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="start">
                <div className="flex gap-3">
                    {/* Hours */}
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground mb-1 text-center">Hour</span>
                        <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto pr-1">
                            {hours12.map((h) => (
                                <Button
                                    key={h}
                                    variant={hour === h ? "default" : "ghost"}
                                    size="sm"
                                    className="w-10 h-8"
                                    onClick={() => handleHourChange(h)}
                                >
                                    {h}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Minutes */}
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground mb-1 text-center">Min</span>
                        <div className="flex flex-col gap-1">
                            {minutes.map((m) => (
                                <Button
                                    key={m}
                                    variant={minute === m ? "default" : "ghost"}
                                    size="sm"
                                    className="w-10 h-8"
                                    onClick={() => handleMinuteChange(m)}
                                >
                                    {m}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* AM/PM */}
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground mb-1 text-center">Period</span>
                        <div className="flex flex-col gap-1">
                            <Button
                                variant={period === 'AM' ? "default" : "ghost"}
                                size="sm"
                                className="w-12 h-8"
                                onClick={() => handlePeriodChange('AM')}
                            >
                                AM
                            </Button>
                            <Button
                                variant={period === 'PM' ? "default" : "ghost"}
                                size="sm"
                                className="w-12 h-8"
                                onClick={() => handlePeriodChange('PM')}
                            >
                                PM
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Quick select common times */}
                <div className="mt-3 pt-3 border-t">
                    <span className="text-xs font-medium text-muted-foreground">Quick select</span>
                    <div className="flex flex-wrap gap-1 mt-2">
                        {['09:30', '10:00', '11:00', '14:00', '15:00', '16:00'].map((t) => {
                            const { hour: qh, minute: qm, period: qp } = parseTime(t);
                            return (
                                <Button
                                    key={t}
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => {
                                        onChange(t);
                                        setOpen(false);
                                    }}
                                >
                                    {qh}:{qm} {qp}
                                </Button>
                            );
                        })}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
