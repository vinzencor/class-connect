import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle, Upload, Loader2, AlertCircle } from 'lucide-react';
import { registrationService } from '@/services/registrationService';
import { admissionSourceService, type AdmissionSource } from '@/services/admissionSourceService';
import { useToast } from '@/hooks/use-toast';

type RegistrationData = Awaited<ReturnType<typeof registrationService.getRegistrationByToken>>;

export default function StudentRegistrationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [registration, setRegistration] = useState<RegistrationData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [whatsappNo, setWhatsappNo] = useState('');
  const [landlineNo, setLandlineNo] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [qualification, setQualification] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [graduationCollege, setGraduationCollege] = useState('');
  const [remarks, setRemarks] = useState('');
  const [admissionSource, setAdmissionSource] = useState('');
  const [reference, setReference] = useState('');
  const [admissionSources, setAdmissionSources] = useState<AdmissionSource[]>([]);
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentMobile, setParentMobile] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }

    const loadRegistration = async () => {
      try {
        const data = await registrationService.getRegistrationByToken(token);
        if (!data) {
          toast({ title: 'Invalid Link', description: 'This registration link is invalid or expired', variant: 'destructive' });
          navigate('/');
          return;
        }

        if (data.status === 'verified') {
          // Already verified
          return;
        }

        if (data.status === 'rejected') {
          // Rejected
          return;
        }

        setRegistration(data);

        // Pre-fill from lead data
        const leadData = data.crm_leads as any;
        if (leadData) {
          setFullName(leadData.name || '');
          setEmail(leadData.email || '');
          setMobileNo(leadData.phone || '');
        }
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to load registration form', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    loadRegistration();
  }, [token, navigate, toast]);

  // Load admission sources once we have the org ID
  useEffect(() => {
    if (!registration?.organization_id) return;
    admissionSourceService.getSources(registration.organization_id).then(setAdmissionSources).catch(console.error);
  }, [registration?.organization_id]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Photo must be less than 5MB', variant: 'destructive' });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image file', variant: 'destructive' });
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!token || !registration) return;

    // Validation
    if (!fullName || !city || !state || !pincode || !dateOfBirth || !gender || !email || !mobileNo || !qualification) {
      toast({ title: 'Validation error', description: 'Please fill in all required fields marked with *', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      let photoUrl = null;

      // Upload photo if selected
      if (photoFile) {
        setPhotoUploading(true);
        try {
          photoUrl = await registrationService.uploadPhoto(photoFile, token);
        } catch (err) {
          console.error('Photo upload error:', err);
          toast({ title: 'Photo upload failed', description: 'Continuing without photo', variant: 'destructive' });
        } finally {
          setPhotoUploading(false);
        }
      }

      // Submit the form
      const today = new Date().toISOString().split('T')[0];
      await registrationService.submitRegistration(token, {
        full_name: fullName,
        address,
        city,
        state,
        pincode,
        date_of_birth: dateOfBirth,
        gender: gender as 'male' | 'female' | 'other',
        email,
        mobile_no: mobileNo,
        whatsapp_no: whatsappNo || undefined,
        landline_no: landlineNo || undefined,
        aadhaar_number: aadhaarNumber || undefined,
        qualification,
        graduation_year: graduationYear || undefined,
        graduation_college: graduationCollege || undefined,
        registration_date: today,
        remarks: remarks || undefined,
        admission_source: admissionSource || undefined,
        reference: reference || undefined,
        photo_url: photoUrl || undefined,
        father_name: fatherName || undefined,
        mother_name: motherName || undefined,
        parent_email: parentEmail || undefined,
        parent_mobile: parentMobile || undefined,
      });

      toast({ title: 'Submitted', description: 'Your registration has been submitted successfully!' });
      setTimeout(() => {
        setRegistration((prev) => (prev ? { ...prev, status: 'submitted' } : prev));
      }, 500);
    } catch (err) {
      console.error(err);
      const message = (err as unknown as Error)?.message || 'Failed to submit registration';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!registration) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Invalid Link
            </CardTitle>
            <CardDescription>This registration link is invalid or has expired.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (registration.status === 'submitted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              Registration Submitted
            </CardTitle>
            <CardDescription>
              Your registration has been submitted successfully. We will review your application and contact you shortly.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (registration.status === 'verified') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              Registration Verified
            </CardTitle>
            <CardDescription>
              Your registration has been verified. You should receive a password setup email shortly. Please check your inbox at {registration.email}.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (registration.status === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Registration Rejected
            </CardTitle>
            <CardDescription>
              Your registration has been rejected. Please contact the administration for more details.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const orgData = registration.organizations as any;
  const courseData = registration.classes as any;
  const batchData = registration.batches as any;

  return (
    <div className="min-h-screen bg-muted/50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-2">
          <CardHeader className="text-center">
            {orgData?.logo_url && (
              <div className="flex justify-center mb-4">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={orgData.logo_url} alt={orgData.name} />
                  <AvatarFallback>{orgData.name?.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>
            )}
            <CardTitle className="text-2xl">{orgData?.name || 'Student Registration'}</CardTitle>
            <CardDescription className="text-base">
              Please fill in all the required details to complete your registration
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Photo Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Photo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <Avatar className="w-24 h-24">
                {photoPreview ? (
                  <AvatarImage src={photoPreview} />
                ) : (
                  <AvatarFallback>
                    <Upload className="w-8 h-8 text-muted-foreground" />
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1">
                <Label htmlFor="photo" className="cursor-pointer">
                  <div className="border-2 border-dashed rounded-md p-4 text-center hover:bg-muted/50 transition-colors">
                    <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {photoFile ? photoFile.name : 'Click to upload photo (max 5MB)'}
                    </p>
                  </div>
                  <Input
                    id="photo"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                    disabled={submitting}
                  />
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Student Details */}
        <Card>
          <CardHeader>
            <CardTitle>Student Registration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter address"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="State"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode *</Label>
                <Input
                  id="pincode"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="Pincode"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth *</Label>
                <Input
                  id="dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender *</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email ID *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile No. *</Label>
                <Input
                  id="mobile"
                  type="tel"
                  value={mobileNo}
                  onChange={(e) => setMobileNo(e.target.value)}
                  placeholder="+91..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp No.</Label>
                <Input
                  id="whatsapp"
                  type="tel"
                  value={whatsappNo}
                  onChange={(e) => setWhatsappNo(e.target.value)}
                  placeholder="+91..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="landline">Landline No.</Label>
                <Input
                  id="landline"
                  type="tel"
                  value={landlineNo}
                  onChange={(e) => setLandlineNo(e.target.value)}
                  placeholder="Landline"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aadhaar">Aadhaar Number</Label>
                <Input
                  id="aadhaar"
                  value={aadhaarNumber}
                  onChange={(e) => setAadhaarNumber(e.target.value)}
                  placeholder="XXXX XXXX XXXX"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="qualification">Qualification *</Label>
                <Input
                  id="qualification"
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value)}
                  placeholder="e.g., 12th Pass"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gradYear">Graduation Year</Label>
                <Input
                  id="gradYear"
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value)}
                  placeholder="YYYY"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admissionSource">Admission Source</Label>
                <Select value={admissionSource} onValueChange={setAdmissionSource}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>
                    {admissionSources.map((s) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                    {admissionSources.length === 0 && (
                      <SelectItem value="__none__" disabled>No sources available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Reference</Label>
                <Input
                  id="reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Reference person/source"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="college">Graduation College</Label>
              <Input
                id="college"
                value={graduationCollege}
                onChange={(e) => setGraduationCollege(e.target.value)}
                placeholder="College name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Any additional information"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Parent Details */}
        <Card>
          <CardHeader>
            <CardTitle>Parent Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fatherName">Father Name</Label>
                <Input
                  id="fatherName"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  placeholder="Father's name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="motherName">Mother Name</Label>
                <Input
                  id="motherName"
                  value={motherName}
                  onChange={(e) => setMotherName(e.target.value)}
                  placeholder="Mother's name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="parentEmail">Email ID</Label>
                <Input
                  id="parentEmail"
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="parent@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parentMobile">Mobile No.</Label>
                <Input
                  id="parentMobile"
                  type="tel"
                  value={parentMobile}
                  onChange={(e) => setParentMobile(e.target.value)}
                  placeholder="+91..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Course Details (Read-only) */}
        <Card>
          <CardHeader>
            <CardTitle>Course Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Course *</Label>
                <Input value={courseData?.name || 'N/A'} disabled />
              </div>
              <div className="space-y-2">
                <Label>Batch *</Label>
                <Input value={batchData?.name || 'N/A'} disabled />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Course Fee *</Label>
                <Input value={`₹${registration.course_fee?.toFixed(2) || '0.00'}`} disabled />
              </div>
              <div className="space-y-2">
                <Label>Discount Amount *</Label>
                <Input value={`₹${registration.discount_amount?.toFixed(2) || '0.00'}`} disabled />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tax Inclusive? *</Label>
                <Input value={registration.tax_inclusive ? 'Yes' : 'No'} disabled />
              </div>
              <div className="space-y-2">
                <Label>Fee Actual *</Label>
                <Input value={`₹${registration.fee_actual?.toFixed(2) || '0.00'}`} disabled />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tax *</Label>
                <Input value={`${registration.tax_percentage || 0}%`} disabled />
              </div>
              <div className="space-y-2">
                <Label>Tax Amount *</Label>
                <Input value={`₹${registration.tax_amount?.toFixed(2) || '0.00'}`} disabled />
              </div>
              <div className="space-y-2">
                <Label>Total Amount *</Label>
                <Input
                  value={`₹${registration.total_amount?.toFixed(2) || '0.00'}`}
                  disabled
                  className="font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Payment Type *</Label>
                <Input value={registration.payment_type || 'N/A'} disabled />
              </div>
              <div className="space-y-2">
                <Label>Advance Payment *</Label>
                <Input value={`₹${registration.advance_payment?.toFixed(2) || '0.00'}`} disabled />
              </div>
              <div className="space-y-2">
                <Label>Balance Amount *</Label>
                <Input value={`₹${registration.balance_amount?.toFixed(2) || '0.00'}`} disabled />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Card>
          <CardContent className="pt-6">
            <Button
              className="w-full bg-primary text-primary-foreground"
              onClick={handleSubmit}
              disabled={submitting || photoUploading}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : photoUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading photo...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Submit Registration
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-3">
              * Required fields. Your information will be reviewed by the administration.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
